DROP VIEW IF EXISTS v_latest_scan_per_package;

CREATE VIEW v_latest_scan_per_package AS
SELECT scan_id,
       scan_uuid,
       owner,
       package_name,
       scan_started_at,
       scan_completed_at
FROM (
         SELECT
             ps.scan_id,
             ps.scan_uuid,
             ps.owner,
             ps.package_name,
             ps.scan_started_at,
             ps.scan_completed_at,
             ROW_NUMBER() OVER (
                 PARTITION BY ps.owner, ps.package_name
                 ORDER BY ps.scan_completed_at DESC, ps.scan_id DESC
                 ) AS rn
         FROM package_scans ps
         WHERE ps.scan_completed_at IS NOT NULL
           AND ps.status = 'completed'
     )
WHERE rn = 1
;
