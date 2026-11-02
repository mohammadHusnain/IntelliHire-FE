from drf_spectacular.extensions import OpenApiAuthenticationExtension


class StatusAwareJWTScheme(OpenApiAuthenticationExtension):
    target_class = "apps.Module1_Authentication.authentication.StatusAwareJWTAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
