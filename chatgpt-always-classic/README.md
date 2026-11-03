# ChatGPT - Always Classic

Version **1.0.5**. A userscript for Tampermonkey and Violentmonkey that adds `oauth_return_surface=classic` to pages on `chatgpt.com`, except Dots (`/dots` and `/dots/*`), and restores the appropriate URL after navigation. A command in the **Violentmonkey menu** lets you change and save the preference.

## Install or upgrade

[Install the userscript](https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.js)

[Open the plain-text copy](https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.txt)

If you already installed version 1.0.0, install this version once or replace the contents of the existing script with the plain-text copy. The original name and namespace are preserved, so it remains the same userscript.

If the JavaScript install link does not open your userscript manager, open the plain-text copy, paste all its contents into the manager, and save. Reload all open ChatGPT tabs after installation or upgrade so Violentmonkey replaces the old running script and menu registration.

## Toggle in Violentmonkey

Open ChatGPT, click the **Violentmonkey extension icon**, and open the commands for **ChatGPT - Always Classic**. When caption updates are supported, the command displays the saved state and the action:

- **Modo clásico: ON (desactivar)** turns classic mode off.
- **Modo clásico: OFF (activar)** turns classic mode on.

The script adds no button, panel, or styles to the page. It runs in Violentmonkey's isolated `content` context. Leave the script's injection setting at its metadata/default value; an explicit per-script `page` override would undo this compatibility change.

Violentmonkey 2.15.9 and newer support the stable command ID used to update the caption in place. Managers that do not confirm this support retain one functional **Alternar modo clásico** command with a neutral caption. Older extension releases with caption-refresh bugs may also keep that neutral caption while the toggle continues to work.

ON is the default and keeps `oauth_return_surface=classic` outside Dots. OFF removes only the `classic` value and stops adding it during navigation. Selecting the command saves the preference and reloads the current non-Dots tab.

On Dots, the command includes **Dots excluido**. It changes the saved preference for other ChatGPT pages without reloading Dots or adding `classic` there.

Existing preferences from version 1.0.3 are preserved. Other open tabs synchronize the preference and URL without a forced reload; their menu command can show **Recarga para aplicar**. If saving fails, the previous state remains active and the menu command reports the error.

The saved preference uses local storage. Clearing ChatGPT site data resets it to ON, and private browsing stores it only for that private session.

## Automatic updates

Both `@updateURL` and `@downloadURL` point to the public `.user.js` file on the `main` branch. With automatic update checks enabled in your userscript manager, it can detect and install future versions according to its update settings.

To publish an update, increase `@version`, update the `.user.js` file and its identical `.user.txt` copy, and commit both to `main`. Keep the name and namespace stable. No separate scheduler or custom update code is needed.

## Behavior

- When ON, adds or replaces `oauth_return_surface` with a single `classic` value on the exact `chatgpt.com` host, except `/dots` and its subroutes.
- When OFF, removes only `classic` and preserves other surface values.
- On Dots, removes any `classic` value already present while preserving other `oauth_return_surface` values. This includes `https://chatgpt.com/dots/home`.
- Keeps URL observation active on Dots so entering and leaving it within the same tab applies the appropriate rule.
- Preserves other query parameter values and URL fragments.
- Loads the initial corrected URL so the server can receive the parameter.
- Observes Navigation API events, Back/Forward, fragment changes, page restoration, and tab activation. It corrects the URL with native `history.replaceState` while preserving history state.
- A lightweight URL comparison every 250 ms catches SPA changes when navigation events are unavailable. Corrections happen after navigation; background throttling can delay the timer. It does not patch ChatGPT's JavaScript or force reloads during SPA navigation.
- Uses a short session-storage redirect guard if the server strips the parameter repeatedly. If storage is blocked, that guard is unavailable.

The script controls the URL parameter; ChatGPT determines what effect that parameter has on its interface.

## Changes in 1.0.5

- Run in isolated content context instead of forcing a page-world injection, removing this script's dependence on Violentmonkey's page-message bridge.
- Keep the toggle callback under one fixed ID and update its caption in place; remove unregister/re-register churn.
- Replace page History patches with navigation events and a lightweight URL-change fallback, preserving Dots and saved preferences.
- Keep the automatic-update URLs and identical JavaScript/plain-text distributions.

### Reported `injected.js / Command` error

The supplied stack is consistent with Violentmonkey's internal command dispatcher trying to call an absent page bridge, before reaching the userscript callback. This release removes the script's page-bridge dependency. The same upstream path can also be triggered when a command is broadcast to an unrelated frame where this script does not run; a userscript cannot repair that extension dispatcher.

Reload existing ChatGPT tabs after upgrading. If the same error persists, check the installed Violentmonkey version and whether the command actually changes the saved state. Those details distinguish a failure in the target tab from an error in another frame.

Validation uses automated simulations of isolated page/content contexts, the relevant command-dispatch branch, navigation events, fallback timers, and storage behavior. It is not a live test in the user's installed extension.

Run the regression checks with:

```sh
node --test chatgpt-always-classic/tests/content-menu.test.cjs
```

## Changes in 1.0.4

- Move the ON/OFF toggle into the userscript-manager menu.
- Remove the floating page control and all its DOM and CSS code.
- Preserve existing preferences, Dots exclusions, and automatic-update URLs.
- Keep SPA interception attached to the actual page History object after adding menu API grants.

## Changes in 1.0.3

- Add the visible Clásico ON/OFF switch with a persistent preference.
- Apply manual changes by reloading only the current non-Dots tab.
- Keep Dots excluded in both states and retain SPA navigation handling.
- Synchronize saved preferences across tabs without reloading active conversations.
- Preserve the script identity and automatic-update URLs.

## Changes in 1.0.2

- Exclude `/dots` and all its subroutes from classic-surface enforcement.
- Remove stale `classic` values on Dots during direct loading and in-page navigation.
- Preserve any other surface values explicitly supplied for Dots.
- Keep automatic-update URLs unchanged.

## Changes in 1.0.1

- Publish the script on GitHub.
- Add the homepage, update, and download URLs.
- Preserve the behavior of version 1.0.0.

## References

- [Tampermonkey update metadata](https://www.tampermonkey.net/documentation.php?locale=en&q=update_url)
- [Violentmonkey metadata](https://violentmonkey.github.io/api/metadata-block/)
- [Browser local storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Violentmonkey menu commands and sandbox APIs](https://violentmonkey.github.io/api/gm/#gm_registermenucommand)

- [Violentmonkey injection contexts](https://violentmonkey.github.io/posts/inject-into-context/)
- [Navigation currententrychange event](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/currententrychange_event)
- [Violentmonkey command bridge source](https://github.com/violentmonkey/violentmonkey/blob/37cdb9a10cacd70aa8b94eceea1554ace388d1d1/src/injected/content/inject.js)
