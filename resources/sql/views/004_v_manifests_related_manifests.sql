DROP VIEW IF EXISTS v_manifests_related_manifests;

CREATE VIEW v_manifests_related_manifests AS
WITH source_manifests AS (
  SELECT
    m.scan_id,
    lsp.owner,
    lsp.package_name,
    m.digest AS source_manifest_digest,
    m.media_type AS source_media_type
  FROM manifests m
  JOIN v_latest_scan_per_package lsp
    ON lsp.scan_id = m.scan_id
),
manifest_seen_window AS (
  SELECT
    md.scan_id,
    md.manifest_digest,
    MIN(md.created_at) AS first_seen_at,
    MAX(md.created_at) AS last_seen_at
  FROM (
    SELECT m.scan_id, m.digest AS manifest_digest, pv.created_at
    FROM manifests m
    JOIN package_versions pv
      ON pv.scan_id = m.scan_id
     AND pv.digest = m.digest

    UNION

    SELECT m.scan_id, m.digest AS manifest_digest, pv.created_at
    FROM manifests m
    JOIN package_versions pv
      ON pv.scan_id = m.scan_id
    JOIN manifest_reachability r
      ON r.scan_id = m.scan_id
     AND r.ancestor_digest = pv.digest
     AND r.descendant_digest = m.digest
  ) md
  GROUP BY
    md.scan_id,
    md.manifest_digest
),
related_manifests AS (
  SELECT
    sm.scan_id,
    sm.owner,
    sm.package_name,
    sm.source_manifest_digest,
    sm.source_media_type,
    sm.source_manifest_digest AS related_manifest_digest,
    sm.source_media_type AS related_media_type,
    0 AS hops_manifest_to_related_manifest
  FROM source_manifests sm

  UNION

  SELECT
    sm.scan_id,
    sm.owner,
    sm.package_name,
    sm.source_manifest_digest,
    sm.source_media_type,
    r.descendant_digest AS related_manifest_digest,
    m.media_type AS related_media_type,
    r.min_distance AS hops_manifest_to_related_manifest
  FROM source_manifests sm
  JOIN manifest_reachability r
    ON r.scan_id = sm.scan_id
   AND r.ancestor_digest = sm.source_manifest_digest
  JOIN manifests m
    ON m.scan_id = sm.scan_id
   AND m.digest = r.descendant_digest

  UNION

  SELECT
    sm.scan_id,
    sm.owner,
    sm.package_name,
    sm.source_manifest_digest,
    sm.source_media_type,
    r.ancestor_digest AS related_manifest_digest,
    m.media_type AS related_media_type,
    r.min_distance AS hops_manifest_to_related_manifest
  FROM source_manifests sm
  JOIN manifest_reachability r
    ON r.scan_id = sm.scan_id
   AND r.descendant_digest = sm.source_manifest_digest
  JOIN manifests m
    ON m.scan_id = sm.scan_id
   AND m.digest = r.ancestor_digest
),
closest_related_manifests AS (
  SELECT
    scan_id,
    owner,
    package_name,
    source_manifest_digest,
    source_media_type,
    related_manifest_digest,
    related_media_type,
    MIN(hops_manifest_to_related_manifest) AS hops_manifest_to_related_manifest
  FROM related_manifests
  GROUP BY
    scan_id,
    owner,
    package_name,
    source_manifest_digest,
    source_media_type,
    related_manifest_digest,
    related_media_type
)
SELECT
  crm.scan_id,
  crm.owner,
  crm.package_name,
  crm.source_manifest_digest,
  crm.source_media_type,
  ssw.first_seen_at AS source_first_seen_at,
  ssw.last_seen_at AS source_last_seen_at,
  st.tag AS source_tag,
  st.version_id AS source_version_id,
  crm.related_manifest_digest,
  crm.related_media_type,
  rsw.first_seen_at AS related_first_seen_at,
  rsw.last_seen_at AS related_last_seen_at,
  crm.hops_manifest_to_related_manifest,
  rt.tag AS related_tag,
  rt.version_id AS related_version_id
FROM closest_related_manifests crm
LEFT JOIN manifest_seen_window ssw
  ON ssw.scan_id = crm.scan_id
 AND ssw.manifest_digest = crm.source_manifest_digest
LEFT JOIN tags st
  ON st.scan_id = crm.scan_id
 AND st.digest = crm.source_manifest_digest
LEFT JOIN manifest_seen_window rsw
  ON rsw.scan_id = crm.scan_id
 AND rsw.manifest_digest = crm.related_manifest_digest
LEFT JOIN tags rt
  ON rt.scan_id = crm.scan_id
 AND rt.digest = crm.related_manifest_digest;
