import type { ChangeRequest } from '../data/changes'

// Stub: swap for a POST to the server once an email provider (Resend, Nodemailer) is wired up.
export function notifyChangeDecision(change: ChangeRequest): void {
  console.log(
    `[email stub] To: ${change.requestedBy} | "${change.title}" was ${change.status} by ${change.decidedBy}`,
  )
}

export function notifyDecisionUndone(change: ChangeRequest): void {
  console.log(
    `[email stub] To: ${change.requestedBy} | Client withdrew their ${change.status} decision on "${change.title}", it is pending again`,
  )
}
