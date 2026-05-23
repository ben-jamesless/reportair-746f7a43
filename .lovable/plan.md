I found these logo/icon-like assets in the backend storage/database:

```text
Referenced by project records:
- Hong Kong Open
  export-assets/981e8553-8a0d-401d-be6a-0d999b350b46/project-logo-1779339124154-LHKO_2025_LockupLogo_RGB_Lockup_Positive.png

- The Hoppening - Ben Admin
  export-assets/a0cfd3db-a253-4f99-8502-1dc357a96b01/project-logo-1779083025308-Ginsanity_LogoMidnight-Pos-HI.jpg

Unreferenced logo/icon-like files in storage:
- export-assets/085fce3b-9595-4de0-9e9d-1de30d839ff5/logo-1778575172773-DotTrackAsia_LogoInCircleMultiBlueHI.png
- export-assets/085fce3b-9595-4de0-9e9d-1de30d839ff5/project-logo-1778582173536-DotTrackAsia_LogoInCircleMultiBlueHI.png
- export-assets/b7b1d948-5fdc-4504-853f-82f01d6e1f89/project-logo-1778580116251-DotTrackAsia_LogoInCircleMultiBlueHI.png
```

Plan:
1. Show these assets in a simple review list/table so you can identify which ones are wrong.
2. Only delete the exact icons/logos you confirm are unwanted.
3. If the wrong share-page logo is coming from code rather than database storage, update `ShareBrandingFooter` to use the marketing homepage brand component directly and ignore stored project/team logos there.

Technical details:
- The `export-assets` bucket is private, so I can list filenames and database references, but I should not expose permanent public image URLs.
- Deleting storage objects is a destructive data change, so I’ll wait for your confirmation on the exact filenames before removing anything.