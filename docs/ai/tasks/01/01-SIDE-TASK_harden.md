# 01 Side Task: Hardening

## Task

While we are on a larger refactoring, I want to solve a few things as side-task(s).

## Side Task A: Protect private image registry

While the scanned repo can be private, the resulting DBs visibility depends on the running workflows settings.

And I think there can very well be a difference, resulting in information about hidden/private registries becoming
public.

If you agree, I have the following idea to solve this and want to discuss it.

### Solution Idea

I think we can query or otherwise detect if the package/registry is private when we scan it.

And then we could put that info in the DB in the table `package_scans`.

And at the end when we decide whether to publish the DB, we can:

1. Query that table and if at least one scan was for a private package, then:
2. Use a new optional parameter or secret or such to the action to encrypt the DB or the zipped artifact.

That new optional encryption thing can also be used on non-private registries when present, but if data of a private
registry is in the DB it shall be required.

## Side Task B: Protect against registry modifications during scan

The scan of a large registry can take time: The last scan for registry `aicage/aicage` with >90k manifests took 35 min.

And we have no check if the registry was modified in between. I'm especially thinking of the paginated reading of
package-versions and assume manifests to be immutable.

Here I fear that adding one manifest/package-version while our paginated import is running would move all pages by one
manifest while our import algorithm has no way of detecting that.

### Solution Idea: Check first and maybe last package-version after import

If you agree that this can be a problem: My solution idea is to read the first and maybe last page or single
package-version again after reading last page and verifying that it did not change. If it changed then the registry was
modified and we should either abort or restart the scan. Abort with error is probably easier for now.
