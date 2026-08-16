# Zenith Fitness Security Specification

## 1. Data Invariants
- **User Ownership**: All fitness data (meals, goals, habits, sleep records) belongs strictly to the user matched by `request.auth.uid`. No user can read or modify another user's progress.
- **Timestamp Integrity**: Core entries use server-provided write times for audits (`request.time`).
- **Data Validation Bounds**: To guard against database spam or wallet-denial attacks:
  - Strings (food name, habit name) are capped below 200 characters.
  - Sleep hours are constrained between 0 and 24 hours.
  - Macros/caloric targets are capped to realistic physical bounds (e.g., calories <= 10000, protein <= 1000).

## 2. The Dirty Dozen Payloads
Below are 12 malicious payloads that Zenith Fitness security rules MUST block:

1. **Identity Spoofing - Meal Hijacking**: Creating a meal under another user's UID (`userId: "victim123"`).
2. **PII Exposure - Blanket Probe**: Attempting to query `/users/*/private/info` to harvest emails.
3. **Privilege Escalation**: Attempting to write an unauthorized admin flag or role.
4. **Boundary Violation - Toxic Sleep Duration**: Setting `hours: -5` or `hours: 99.5` in a sleep record.
5. **Format Poisoning - Huge String ID**: Injecting a 2MB binary key string as the `habitId` to exhaust Firestore index resources.
6. **Integrity Attack - Future Logging**: Creating a meal or habit entry dated in the far future or using client-controlled timestamps instead of `request.time`.
7. **Negative Nutritions**: Logging meals with negative calories (`calories: -2500`).
8. **Malicious Keys (Shadow Update)**: Attempting to patch goals with extra invalid fields like `isAdmin: true` or `isPremium: true`.
9. **Duplicate ID Cross-Writing**: Using non-alphanumeric special characters in IDs to trigger path-escape vulnerabilities.
10. **State Corruption - Empty Habit Names**: Saving custom habits with empty names or excessively long strings.
11. **Malicious Enum Injection**: Set sleep quality to something other than `Good`, `Average`, or `Poor` (e.g., `Excellent`).
12. **Unauthenticated Tampering**: Sending any write operation without valid request auth tokens.

## 3. Test Cases (TDD Verification)
Security rules are structured such that all of the above payloads return `PERMISSION_DENIED` automatically.
