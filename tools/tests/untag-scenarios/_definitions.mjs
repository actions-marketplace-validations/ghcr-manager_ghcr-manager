export const untagScenarios = {
  "untag-single-tag-single-root": {
    id: "untag-single-tag-single-root",
    packageSuffix: "untag--single-tag-single-root",
    seedStrategy: "tagged-fully-deletable",
    tagNames: {
      deleteTag: "delete-me"
    }
  },
  "untag-one-of-two-tags-single-root": {
    id: "untag-one-of-two-tags-single-root",
    packageSuffix: "untag--one-of-two-tags-single-root",
    seedStrategy: "untag-only-single-shared-root",
    tagNames: {
      deleteTag: "delete-me",
      keepTag: "keep-me"
    }
  },
  "untag-one-of-two-tags-docker-manifest-list": {
    id: "untag-one-of-two-tags-docker-manifest-list",
    packageSuffix: "untag--one-of-two-tags-docker-manifest-list",
    seedStrategy: "docker-manifest-list-untag-only-shared-root",
    tagNames: {
      deleteTag: "delete-me",
      keepTag: "keep-me"
    },
    scanAssertions: [
      {
        tagNameKey: "keepTag",
        expectedManifestKind: "image_index",
        expectedManifestMediaType: "application/vnd.docker.distribution.manifest.list.v2+json",
        requireRoot: true
      }
    ]
  }
};
