# [Komf](https://github.com/Snd-R/komf) userscript fork (Kavita-focused)

Adds KOMF integration to Komga/Kavita UI, with this fork focused on Kavita workflows.

---

### New menus in ui:

- Config dialog in main view
- Menu in library toolbar with option to automatically identify all series inside
- Menu in series toolbar with options to manually or automatically match current series

### Fork notes

- This fork tracks custom Kavita-focused behavior and config UX updates.
- Cover lock controls are split in settings:
  - `Lock Series Cover`
  - `Lock Volume Cover`
- Official extension may still show a combined `Lock Covers` toggle. This userscript fork exposes both flags separately.
- KOMF server URL still defaults to `http://localhost:8085` in UI settings; change it in Settings for custom instances.

### Installation

Requires tampermonkey or any other supported userscript manager.

- Build or download the latest version from release page
- Import the file into script manager
- Set `@include`  to your komga or kavita server url (or both)
- Set `komf url` in Komf settings from Komga or Kavita UI
