from django.db import migrations

CREATE = """
CREATE FUNCTION evaluation_hrdecision_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'A recorded HR decision cannot be changed or removed (append-only)' USING ERRCODE = '23000';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER evaluation_hrdecision_append_only
    BEFORE UPDATE OR DELETE ON evaluation_hrdecision
    FOR EACH ROW EXECUTE FUNCTION evaluation_hrdecision_append_only();
"""
DROP = """
DROP TRIGGER IF EXISTS evaluation_hrdecision_append_only ON evaluation_hrdecision;
DROP FUNCTION IF EXISTS evaluation_hrdecision_append_only();
"""


class Migration(migrations.Migration):
    """FR-58: decisions are permanent. The database itself refuses to change or delete a row, whatever the code does."""

    dependencies = [("evaluation", "0001_initial")]
    operations = [migrations.RunSQL(CREATE, DROP)]
