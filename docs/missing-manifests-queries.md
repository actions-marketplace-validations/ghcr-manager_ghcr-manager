# Missing Manifests SQL Recipes

This document captures SQL recipes to find manifest digests that were discovered during ingest but are missing from
`manifests` in a completed scan.

Operational context:

- GHCR scans may encounter `404` for some digests.
- Ingest skips these missing manifests and continues.
- Missing digests can be derived from DB state; logs are not required as the only source.

## Target Scan CTE

All queries below use this base CTE:

```sql
WITH target_scan AS (
  SELECT scan_id
  FROM package_scans
  WHERE package_name = 'aicage/aicage' AND status = 'completed'
  ORDER BY scan_started_at DESC
  LIMIT 1
)
```

Replace `'aicage/aicage'` with your package name.

## Missing Descriptor Children

Descriptor child digest exists, but no manifest row exists for that digest.

```sql
WITH target_scan AS (
  SELECT scan_id
  FROM package_scans
  WHERE package_name = 'aicage/aicage' AND status = 'completed'
  ORDER BY scan_started_at DESC
  LIMIT 1
)
SELECT DISTINCT d.child_digest AS digest
FROM manifest_descriptors d
LEFT JOIN manifests m
  ON m.scan_id = d.scan_id
 AND m.digest = d.child_digest
WHERE d.scan_id = (SELECT scan_id FROM target_scan)
  AND m.digest IS NULL
ORDER BY digest;
```

## Missing Subjects

A manifest `subject_digest` points to a digest that has no manifest row.

```sql
WITH target_scan AS (
  SELECT scan_id
  FROM package_scans
  WHERE package_name = 'aicage/aicage' AND status = 'completed'
  ORDER BY scan_started_at DESC
  LIMIT 1
)
SELECT DISTINCT mf.subject_digest AS digest
FROM manifests mf
LEFT JOIN manifests m
  ON m.scan_id = mf.scan_id
 AND m.digest = mf.subject_digest
WHERE mf.scan_id = (SELECT scan_id FROM target_scan)
  AND mf.subject_digest IS NOT NULL
  AND m.digest IS NULL
ORDER BY digest;
```

## Missing Union (Closest To Skip-Warn Semantics)

Distinct missing digests from descriptor children and subjects combined.

```sql
WITH target_scan AS (
  SELECT scan_id
  FROM package_scans
  WHERE package_name = 'aicage/aicage' AND status = 'completed'
  ORDER BY scan_started_at DESC
  LIMIT 1
),
missing_descriptor_children AS (
  SELECT DISTINCT d.child_digest AS digest
  FROM manifest_descriptors d
  LEFT JOIN manifests m
    ON m.scan_id = d.scan_id
   AND m.digest = d.child_digest
  WHERE d.scan_id = (SELECT scan_id FROM target_scan)
    AND m.digest IS NULL
),
missing_subjects AS (
  SELECT DISTINCT mf.subject_digest AS digest
  FROM manifests mf
  LEFT JOIN manifests m
    ON m.scan_id = mf.scan_id
   AND m.digest = mf.subject_digest
  WHERE mf.scan_id = (SELECT scan_id FROM target_scan)
    AND mf.subject_digest IS NOT NULL
    AND m.digest IS NULL
)
SELECT digest
FROM (
  SELECT digest FROM missing_descriptor_children
  UNION
  SELECT digest FROM missing_subjects
)
ORDER BY digest;
```

## Count + Overlap Breakdown

Useful to explain why warn-line count and one single query can differ.

```sql
WITH target_scan AS (
  SELECT scan_id
  FROM package_scans
  WHERE package_name = 'aicage/aicage' AND status = 'completed'
  ORDER BY scan_started_at DESC
  LIMIT 1
),
a AS (
  SELECT DISTINCT d.child_digest AS digest
  FROM manifest_descriptors d
  LEFT JOIN manifests m
    ON m.scan_id = d.scan_id
   AND m.digest = d.child_digest
  WHERE d.scan_id = (SELECT scan_id FROM target_scan)
    AND m.digest IS NULL
),
b AS (
  SELECT DISTINCT mf.subject_digest AS digest
  FROM manifests mf
  LEFT JOIN manifests m
    ON m.scan_id = mf.scan_id
   AND m.digest = mf.subject_digest
  WHERE mf.scan_id = (SELECT scan_id FROM target_scan)
    AND mf.subject_digest IS NOT NULL
    AND m.digest IS NULL
)
SELECT
  (SELECT COUNT(*) FROM a) AS missing_descriptor_children,
  (SELECT COUNT(*) FROM b) AS missing_subjects,
  (SELECT COUNT(*) FROM (SELECT digest FROM a UNION SELECT digest FROM b)) AS missing_union,
  (SELECT COUNT(*) FROM (SELECT digest FROM a INTERSECT SELECT digest FROM b)) AS overlap;
```
