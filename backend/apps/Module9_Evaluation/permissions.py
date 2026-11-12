from apps.common.choices import MemberRole
from apps.common.permissions import CompanyRole

# Generate a report and record decisions: admin, HR manager, recruiter. Viewers only read.
CanDecide = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER)
# Change how a job's stage scores are combined: admin and HR manager.
CanManageWeights = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER)
