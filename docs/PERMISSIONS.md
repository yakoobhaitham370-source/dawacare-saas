# Permissions

| Operation | Platform admin + MFA | Owner | Pharmacist | Technician |
|---|---|---|---|---|
| Provision pharmacies and plans/billing | Yes | No | No | No |
| Read patient records | No default access | Own pharmacy | Own pharmacy | Own pharmacy |
| Register/edit basic patients, contact outcomes | No default access | Yes | Yes | Yes |
| Approve medications, dispensing, labs | No default access | Yes | Yes | No |
| Invite/change pharmacy staff | Initial owner only | Pharmacist/technician only | No | No |
| Change own role or another owner's role | No public workflow | No | No | No |
| Extract/review AI | No default access | Yes, within quota | Yes, within quota | No |
| Upload authorized private documents | No default access | Yes | Yes | Yes |
| Archive documents | No default access | Yes | Yes | No |
| Delete dispensing or audit history | No public workflow | No | No | No |

Database enforcement is authoritative. Browser routing and disabled actions improve usability but do not replace RLS. Subscription restrictions apply to all pharmacy writes. Authorized clinical read/export retention is 90 days after subscription end; cancellation/suspension stops writes immediately. There is no automatic clinical-record deletion.

Technician basic-patient permissions are currently a fixed least-privilege baseline; configurable technician policy sets and medication/dispensing draft approval queues remain pending. Exceptional authorized/time-limited clinical support access is not implemented; the platform dashboard has no bypass.
