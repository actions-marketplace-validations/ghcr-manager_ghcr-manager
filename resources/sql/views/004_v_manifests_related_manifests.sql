DROP VIEW IF EXISTS v_manifests_related_manifests;

CREATE VIEW v_manifests_related_manifests AS
WITH source_manifests AS (
  SELECT
    m.scan_id,
    lsp.owner,
    lsp.package_name,
    m.version_id,
    m.digest,
    m.media_type
  FROM manifests m
  JOIN v_latest_scan_per_package lsp
    ON lsp.scan_id = m.scan_id
),
related_manifests AS (
  SELECT
    sm.scan_id,
    sm.owner,
    sm.package_name,
    sm.version_id AS source_version_id,
    sm.digest AS source_digest,
    sm.media_type AS source_media_type,
    sm.version_id AS related_version_id,
    sm.digest AS related_digest,
    sm.media_type AS related_media_type,
    0 AS hops_manifest_to_related_manifest
  FROM source_manifests sm

  UNION

  SELECT
    sm.scan_id,
    sm.owner,
    sm.package_name,
    sm.version_id AS source_version_id,
    sm.digest AS source_digest,
    sm.media_type AS source_media_type,
    m.version_id AS related_version_id,
    m.digest AS related_digest,
    m.media_type AS related_media_type,
    r.min_distance AS hops_manifest_to_related_manifest
  FROM source_manifests sm
  JOIN manifest_reachability r
    ON r.scan_id = sm.scan_id
   AND r.ancestor_digest = sm.digest
  JOIN manifests m
    ON m.scan_id = sm.scan_id
   AND m.digest = r.descendant_digest

  UNION

  SELECT
    sm.scan_id,
    sm.owner,
    sm.package_name,
    sm.version_id AS source_version_id,
    sm.digest AS source_digest,
    sm.media_type AS source_media_type,
    m.version_id AS related_version_id,
    m.digest AS related_digest,
    m.media_type AS related_media_type,
    r.min_distance AS hops_manifest_to_related_manifest
  FROM source_manifests sm
  JOIN manifest_reachability r
    ON r.scan_id = sm.scan_id
   AND r.descendant_digest = sm.digest
  JOIN manifests m
    ON m.scan_id = sm.scan_id
   AND m.digest = r.ancestor_digest
),
closest_related_manifests AS (
  SELECT
    scan_id,
    owner,
    package_name,
    source_version_id,
    source_digest,
    source_media_type,
    related_version_id,
    related_digest,
    related_media_type,
    MIN(hops_manifest_to_related_manifest) AS hops_manifest_to_related_manifest
  FROM related_manifests
  GROUP BY
    scan_id,
    owner,
    package_name,
    source_version_id,
    source_digest,
    source_media_type,
    related_version_id,
    related_digest,
    related_media_type
)
SELECT
  crm.scan_id,
  crm.owner,
  crm.package_name,
  crm.source_digest,
  crm.source_media_type,
  crm.source_version_id,
  spv.created_at AS source_created_at,
  spv.updated_at AS source_updated_at,
  st.tag AS source_tag,
  crm.related_digest,
  crm.related_media_type,
  crm.related_version_id,
  rpv.created_at AS related_created_at,
  rpv.updated_at AS related_updated_at,
  crm.hops_manifest_to_related_manifest,
  rt.tag AS related_tag
FROM closest_related_manifests crm
JOIN package_versions spv
  ON spv.scan_id = crm.scan_id
 AND spv.version_id = crm.source_version_id
LEFT JOIN tags st
  ON st.scan_id = spv.scan_id
 AND st.version_id = spv.version_id
JOIN package_versions rpv
  ON rpv.scan_id = crm.scan_id
 AND rpv.version_id = crm.related_version_id
LEFT JOIN tags rt
  ON rt.scan_id = crm.scan_id
 AND rt.version_id = rpv.version_id;
