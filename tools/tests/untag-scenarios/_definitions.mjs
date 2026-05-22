export const untagScenarios = {
  "untag-single-tag-single-root": {
    id: "untag-single-tag-single-root",
    packageSuffix: "untag--single-tag-single-root",
    seedStrategy: "untag-single-tag-single-root",
    tagNames: {
      deleteTag: "delete-me",
      keepTag: "keep-me"
    }
  },
  "untag-one-of-two-tags-single-root": {
    id: "untag-one-of-two-tags-single-root",
    packageSuffix: "untag--one-of-two-tags-single-root",
    seedStrategy: "untag-one-of-two-tags-single-root",
    tagNames: {
      deleteTag: "delete-me",
      keepTag: "keep-me"
    }
  },
  "untag-one-of-two-tags-docker-manifest-list": {
    id: "untag-one-of-two-tags-docker-manifest-list",
    packageSuffix: "untag--one-of-two-tags-docker-manifest-list",
    seedStrategy: "untag-one-of-two-tags-docker-manifest-list",
    tagNames: {
      deleteTag: "delete-me",
      keepTag: "keep-me"
    },
    scanAssertions: [
      {
        tagNameKey: "keepTag",
        expectedManifestKind: "cross_arch_manifest",
        expectedManifestMediaType: "application/vnd.docker.distribution.manifest.list.v2+json",
        requireRoot: true
      }
    ]
  }
};
