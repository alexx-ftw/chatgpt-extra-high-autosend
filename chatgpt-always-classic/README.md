# ChatGPT - Always Classic

Version **1.0.4**. A userscript for Tampermonkey and Violentmonkey that adds `oauth_return_surface=classic` to pages on `chatgpt.com`, except Dots (`/dots` and `/dots/*`), and retains the appropriate URL during navigation. A command in the **Violentmonkey menu** lets you change and save the preference.

## Install or upgrade

[Install the userscript](https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.js)

[Open the plain-text copy](https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.txt)

If you already installed version 1.0.0, install this version once or replace the contents of the existing script with the plain-text copy. The original name and namespace are preserved, so it remains the same userscript.

If the JavaScript install link does not open your userscript manager, open the plain-text copy, paste all its contents into the manager, and save. Reload ChatGPT after installation.

## Toggle in Violentmonkey

Open ChatGPT, click the **Violentmonkey extension icon**, and open the commands for **ChatGPT - Always Classic**. The command displays the saved state and the action:

- **Modo clásico: ON (desactivar)** turns classic mode off.
- **Modo clásico: OFF (activar)** turns classic mode on.

The script adds no button, panel, or styles to the page. After upgrading from version 1.0.3, reload open ChatGPT tabs to remove the old floating control and register the menu command.

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
- Keeps the navigation hooks active on Dots so entering and leaving it within the same tab applies the appropriate rule.
- Preserves other query parameter values and URL fragments.
- Loads the initial corrected URL so the server can receive the parameter.
- Retains the parameter during History API navigation, Back/Forward, and fragment changes.
- Uses a short session-storage redirect guard if the server strips the parameter repeatedly. If storage is blocked, that guard is unavailable.

The script controls the URL parameter; ChatGPT determines what effect that parameter has on its interface.

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
