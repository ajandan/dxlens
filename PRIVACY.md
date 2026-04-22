# DX Lens — Privacy Policy

*Last updated: 21 April 2026*

DX Lens ("the extension") is a developer tool that reconstructs a classic-style Clipboard view of runtime state for Pega Constellation applications. This policy explains exactly what the extension does and does not do with data.

## Summary

DX Lens does not collect, transmit, sell, or share any user data. All data the extension processes stays inside your browser on your local device.

## What the extension observes

When you load a Pega Constellation application in a tab, DX Lens observes DX API network traffic that your browser is already making to that application. From those responses it assembles an in-memory clipboard tree containing cases, assignments, data pages, operator context, and the current view, and renders it in the Chrome side panel.

The extension is strictly read-only. It never writes data back to the Pega application and never initiates requests of its own to the application or to any other server.

## What is stored

The only data DX Lens persists is your own extension preferences — for example URL match patterns, snapshot retention cap, and theme — saved via `chrome.storage.local` on your device. These preferences never leave your browser.

Captured DX API payloads, clipboard snapshots, and the Events log are held in memory only, scoped to the tab, and discarded when the tab is closed or the extension is reloaded. They are never written to disk, never synced, and never uploaded.

## What is NOT collected

DX Lens does not collect any of the following: personally identifiable information, authentication credentials, health information, financial or payment information, location, web browsing history, user activity (clicks, keystrokes, mouse movement), or website content outside the Pega DX traffic you explicitly choose to inspect. It does not fingerprint the browser or device.

## No network transmission

The extension itself makes zero outbound network requests. There is no telemetry, no analytics, no crash reporting, no update ping, and no remote configuration. You can verify this by inspecting network activity or by reading the source code.

## Permissions and why they are needed

`storage` is used only to save your local preferences. `scripting` is used to inject the scripts that observe fetch/XHR inside the Pega page. `sidePanel` is used to render the UI in Chrome's side panel. Host permission `<all_urls>` is requested because Pega Constellation applications can be hosted on any domain (customer tenants, on-prem servers, sandboxes, localhost); the extension only activates on pages that actually serve DX API traffic, and in all cases data stays on your device.

## Third parties

DX Lens does not use any third-party services, SDKs, analytics providers, advertising networks, or remote code. It loads no remote scripts.

## Children

The extension is a developer tool not directed to children and does not knowingly process data from children under 13.

## Open source

DX Lens is open source under the MIT license. You can audit the full source code at: https://github.com/ajandan/dxlens

## Changes to this policy

If the extension's data handling ever changes, this policy will be updated and the "Last updated" date above will change. Material changes will be noted in the extension's release notes.

## Contact

Questions about this policy can be filed as an issue on the GitHub repository above.
