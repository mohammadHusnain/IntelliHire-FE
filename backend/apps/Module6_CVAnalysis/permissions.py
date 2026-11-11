from apps.common.choices import MemberRole
from apps.common.permissions import CompanyRole

# Start or repeat an analysis: admin, HR manager, recruiter. Viewers only read.
CanRunScreening = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER)
# Change how a job is screened and shortlist by threshold: admin and HR manager.
CanManageScreening = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER)
