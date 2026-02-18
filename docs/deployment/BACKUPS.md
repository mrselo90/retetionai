# Database Backup Strategy

## Overview

This document outlines the backup strategy for Recete Retention Agent's PostgreSQL database (Supabase).

## Backup Methods

### 1. Supabase Automated Backups

If using Supabase hosted database:
- **Automatic**: Daily backups retained for 7 days
- **Point-in-time recovery**: Available for Pro plan and above
- **Manual backups**: Can be triggered via Supabase dashboard

### 2. Manual pg_dump Backups

For self-hosted PostgreSQL:

```bash
# Full database backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Compressed backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -Z 9 -f backup_$(date +%Y%m%d_%H%M%S).dump.gz
```

### 3. Automated Backup Script

Create a cron job for automated backups:

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * /path/to/backup-script.sh
```

**backup-script.sh:**
```bash
#!/bin/bash
BACKUP_DIR="/backups/recete"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.dump"

mkdir -p $BACKUP_DIR

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.dump.gz" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_FILE.gz s3://your-backup-bucket/recete/
```

## Restore Procedures

### From Supabase Backup

1. Go to Supabase Dashboard
2. Navigate to Database > Backups
3. Select backup point
4. Click "Restore"

### From pg_dump File

```bash
# Restore from dump file
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c backup_file.dump

# Restore from compressed file
gunzip -c backup_file.dump.gz | pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c
```

### Partial Restore (Specific Tables)

```bash
# Restore only specific tables
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -t merchants -t products backup_file.dump
```

## Backup Retention Policy

- **Daily backups**: Keep for 7 days
- **Weekly backups**: Keep for 4 weeks
- **Monthly backups**: Keep for 12 months
- **Yearly backups**: Keep indefinitely

## Backup Verification

Regularly verify backups are restorable:

```bash
# Test restore to temporary database
createdb test_restore
pg_restore -d test_restore backup_file.dump
# Verify data
psql -d test_restore -c "SELECT COUNT(*) FROM merchants;"
# Drop test database
dropdb test_restore
```

## Disaster Recovery Plan

1. **Identify failure**: Database corruption, data loss, etc.
2. **Stop services**: Prevent further data corruption
3. **Assess damage**: Determine backup point needed
4. **Restore backup**: Use most recent clean backup
5. **Verify data**: Check critical tables
6. **Resume services**: Start API, Workers, Web
7. **Monitor**: Watch for errors and data consistency

## Backup Storage

### Local Storage
- Store backups on separate disk/volume
- Use RAID for redundancy

### Cloud Storage
- **AWS S3**: Recommended for production
- **Google Cloud Storage**: Alternative option
- **Azure Blob Storage**: Alternative option

### Encryption

Encrypt backups at rest:

```bash
# Create encrypted backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c | \
  gzip | \
  openssl enc -aes-256-cbc -salt -out backup_encrypted.dump.gz.enc -k $ENCRYPTION_KEY
```

## Monitoring

Set up alerts for:
- Backup failures
- Backup size anomalies
- Backup age (if backups stop running)

## Best Practices

1. **Test restores regularly**: Monthly at minimum
2. **Store backups off-site**: Use cloud storage
3. **Encrypt sensitive data**: Especially customer PII
4. **Document procedures**: Keep restore steps documented
5. **Automate everything**: Use cron jobs or scheduled tasks
6. **Monitor backup health**: Set up alerts
7. **Version control migrations**: Track schema changes

## Supabase-Specific

For Supabase hosted databases:

- Use Supabase dashboard for backups
- Enable point-in-time recovery (Pro plan)
- Export backups to S3 for long-term storage
- Use Supabase CLI for programmatic backups

```bash
# Using Supabase CLI
supabase db dump -f backup.sql
```
