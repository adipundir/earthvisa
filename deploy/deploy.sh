#!/usr/bin/env bash
#
# One command from a working tree to a running service.
#
#   deploy/deploy.sh bootstrap   # build pipeline (once)
#   deploy/deploy.sh build       # package source -> CodeBuild -> ECR
#   deploy/deploy.sh migrate     # run the schema scripts INSIDE the VPC
#   deploy/deploy.sh app         # create/update the ECS service
#   deploy/deploy.sh edge        # create/update CloudFront
#   deploy/deploy.sh all         # build + app
#
# Everything here is idempotent: re-running a step converges rather than
# duplicating. The CloudFormation stacks own every resource they create, so
# `aws cloudformation delete-stack` is a real undo.
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
PROJECT="earthvisa"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUCKET="${PROJECT}-build-${ACCOUNT}"
REGISTRY="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

stack_deploy() {
  local name="$1"; shift
  say "cloudformation: $name"
  aws cloudformation deploy \
    --region "$REGION" \
    --stack-name "$name" \
    --template-file "$1" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset \
    "${@:2}"
}

stack_output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}

# ── bootstrap ────────────────────────────────────────────────────────────────
cmd_bootstrap() {
  stack_deploy "${PROJECT}-build" "$ROOT/deploy/01-build.yml"
  say "build bucket: $(stack_output "${PROJECT}-build" BuildBucketName)"
}

# ── build ────────────────────────────────────────────────────────────────────
cmd_build() {
  local zip="/tmp/${PROJECT}-source.zip"
  rm -f "$zip"

  say "packaging source"
  # Deliberately NOT `git archive`: large parts of this deploy live in files
  # that are not committed yet, and an archive of HEAD would silently build the
  # previous version of the app. This packages the working tree as it stands.
  #
  # .git is excluded because it is large and the container build does not read
  # it - the dataset stage is skipped when src/data/.build-manifest.json matches
  # the sources, which `npm run data:check` verifies below.
  ( cd "$ROOT" && npm run --silent data:check ) || {
    echo "REFUSING TO BUILD: derived data is stale. Run 'npm run data' on a full" >&2
    echo "checkout and commit the result - build-dataset.mjs needs git history," >&2
    echo "which is not present in the container build." >&2
    exit 1
  }

  # The exclusion list MUST stay a superset of .dockerignore's. .env.local
  # holds a live DATABASE_URL (with password) and a live third-party API key;
  # without excluding it here those credentials are uploaded to a versioned S3
  # bucket and retained for 30 days, readable by anyone with s3:GetObject and
  # by the CodeBuild role. The image itself never had them - .dockerignore
  # lists .env* - so this would have leaked them to S3 alone.
  ( cd "$ROOT" && zip -qr "$zip" . \
      -x '*.git/*' 'node_modules/*' '.next/*' 'videos/*' 'video/*' \
         'brand-assets/*' '.claude/*' '*.DS_Store' \
         '.env' '.env.*' '*/.env' '*/.env.*' '*.key' '*.p8' '*.p12' )

  # Prove it, rather than trusting the glob list. A silent zip -x typo is
  # exactly how a credential reaches a bucket.
  if unzip -Z1 "$zip" | grep -qE '(^|/)\.env|\.key$|\.p8$|\.p12$'; then
    echo "REFUSING TO UPLOAD: the source archive contains a secret file:" >&2
    unzip -Z1 "$zip" | grep -E '(^|/)\.env|\.key$|\.p8$|\.p12$' >&2
    exit 1
  fi
  say "source: $(du -h "$zip" | cut -f1) (verified free of .env/key files)"

  aws s3 cp "$zip" "s3://${BUCKET}/source.zip" --region "$REGION"

  say "starting CodeBuild"
  local id
  id="$(aws codebuild start-build --region "$REGION" \
        --project-name "${PROJECT}-web-build" \
        --query 'build.id' --output text)"
  echo "build: $id"

  # Poll rather than tail: the build runs well over an hour on a cold cache.
  local status="IN_PROGRESS"
  while [ "$status" = "IN_PROGRESS" ]; do
    sleep 30
    status="$(aws codebuild batch-get-builds --region "$REGION" --ids "$id" \
              --query 'builds[0].buildStatus' --output text)"
    local phase
    phase="$(aws codebuild batch-get-builds --region "$REGION" --ids "$id" \
             --query 'builds[0].currentPhase' --output text)"
    printf '\r  %s / %s        ' "$status" "$phase"
  done
  echo
  [ "$status" = "SUCCEEDED" ] || {
    echo "build $status - logs:" >&2
    aws codebuild batch-get-builds --region "$REGION" --ids "$id" \
      --query 'builds[0].logs.deepLink' --output text >&2
    exit 1
  }

  # The immutable tag, not :latest. ECS decides whether to replace tasks by
  # comparing image references; a service pointed at a moving tag can keep
  # running the old image through a "successful" deploy.
  IMAGE_URI="$(aws ecr describe-images --region "$REGION" \
    --repository-name "${PROJECT}-web" \
    --query 'sort_by(imageDetails,&imagePushedAt)[-1].imageTags' --output text \
    | tr '\t' '\n' | grep -v '^latest$' | head -1)"
  IMAGE_URI="${REGISTRY}/${PROJECT}-web:${IMAGE_URI}"
  say "image: $IMAGE_URI"
  echo "$IMAGE_URI" > /tmp/${PROJECT}-image-uri
}

image_uri() {
  if [ -n "${IMAGE_URI:-}" ]; then echo "$IMAGE_URI"; return; fi
  if [ -f "/tmp/${PROJECT}-image-uri" ]; then cat "/tmp/${PROJECT}-image-uri"; return; fi
  local tag
  tag="$(aws ecr describe-images --region "$REGION" --repository-name "${PROJECT}-web" \
    --query 'sort_by(imageDetails,&imagePushedAt)[-1].imageTags' --output text \
    | tr '\t' '\n' | grep -v '^latest$' | head -1)"
  [ -n "$tag" ] || { echo "no image in ECR - run 'deploy.sh build' first" >&2; exit 1; }
  echo "${REGISTRY}/${PROJECT}-web:${tag}"
}

# ── migrate ──────────────────────────────────────────────────────────────────
# Runs the four schema scripts as a one-off Fargate task in the app security
# group. This is what makes the operator-IP hole in the RDS security group
# unnecessary: migrations run from inside the VPC, so the database never has to
# be reachable from a laptop whose address changes.
cmd_migrate() {
  local img; img="$(image_uri)"
  say "running migrations in-VPC"
  local task
  task="$(aws ecs run-task --region "$REGION" \
    --cluster "$PROJECT" \
    --launch-type FARGATE \
    --task-definition "${PROJECT}-web" \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-0bf3f228cb82083c6,subnet-0860250d011f9afd2],securityGroups=[sg-0ce1c4755374a4f14],assignPublicIp=ENABLED}" \
    --overrides "{\"containerOverrides\":[{\"name\":\"web\",\"command\":[\"node\",\"scripts/migrate.mjs\"]}]}" \
    --query 'tasks[0].taskArn' --output text)"
  echo "task: $task"
  aws ecs wait tasks-stopped --region "$REGION" --cluster "$PROJECT" --tasks "$task"
  local code
  code="$(aws ecs describe-tasks --region "$REGION" --cluster "$PROJECT" --tasks "$task" \
          --query 'tasks[0].containers[0].exitCode' --output text)"
  say "migration exit code: $code"
  echo "logs: /ecs/${PROJECT}-web  stream prefix 'web'"
  [ "$code" = "0" ] || exit 1
}

# ── app ──────────────────────────────────────────────────────────────────────
cmd_app() {
  local img; img="$(image_uri)"
  local cert="${ORIGIN_CERT_ARN:-}"
  [ -n "$cert" ] || {
    echo "set ORIGIN_CERT_ARN to an ACM cert in ${REGION} for origin.earthvisa.in" >&2
    exit 1
  }
  stack_deploy "${PROJECT}-app" "$ROOT/deploy/02-app.yml" \
    --parameter-overrides "ImageUri=$img" "OriginCertificateArn=$cert"
  say "ALB: $(stack_output "${PROJECT}-app" AlbDnsName)"
  echo "Point origin.earthvisa.in at that name, then verify the site against"
  echo "https://origin.earthvisa.in BEFORE any public DNS moves."
}

# ── edge ─────────────────────────────────────────────────────────────────────
cmd_edge() {
  local cert="${VIEWER_CERT_ARN:-}"
  [ -n "$cert" ] || {
    echo "set VIEWER_CERT_ARN to an ACM cert in us-east-1 covering" >&2
    echo "earthvisa.in and www.earthvisa.in (CloudFront reads certs only from" >&2
    echo "N. Virginia - one issued in ap-south-1 is silently un-attachable)." >&2
    exit 1
  }
  stack_deploy "${PROJECT}-edge" "$ROOT/deploy/03-edge.yml" \
    --parameter-overrides "ViewerCertificateArn=$cert"
  say "CloudFront: $(stack_output "${PROJECT}-edge" DistributionDomain)"
}

case "${1:-}" in
  bootstrap) cmd_bootstrap ;;
  build)     cmd_build ;;
  migrate)   cmd_migrate ;;
  app)       cmd_app ;;
  edge)      cmd_edge ;;
  all)       cmd_build; cmd_app ;;
  *) sed -n '3,14p' "$0"; exit 1 ;;
esac
