from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0004_player_supabase_user_id'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE players ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE',
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='player',
                    name='is_active',
                    field=models.BooleanField(default=True),
                ),
            ],
        ),
    ]
