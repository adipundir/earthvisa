import { NextResponse } from "next/server";
import {
  AuthStoreUnavailableError,
  accountForToken,
  bearerToken,
  deleteAccount,
} from "@/lib/auth/store";

// DELETE /api/auth/account
//
// Permanently deletes the signed-in account. Required by App Store Guideline
// 5.1.1(v): an app that supports account creation must offer account deletion
// from within the app itself, not through a support email or a web form.
//
// Deliberately not a soft delete and deliberately not a "request" that a human
// processes later. The guideline is about the person being able to actually
// remove their data, and a tombstone row is not that.
export async function DELETE(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  try {
    const account = await accountForToken(token);
    // Already gone, or the token is dead. Either way the caller's intent is
    // satisfied, so this is a success rather than an error to argue with.
    if (!account) return NextResponse.json({ ok: true });

    await deleteAccount(account.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError) {
      return NextResponse.json(
        { error: "Could not delete the account right now. Please try again shortly." },
        { status: 503 },
      );
    }
    throw err;
  }
}
