# ChatGPT - Always Classic

Version **1.0.1**. A userscript for Tampermonkey and Violentmonkey that adds `oauth_return_surface=classic` to pages on `chatgpt.com` and retains it during navigation.

## Install or upgrade

[Install the userscript](https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.js)

[Open the plain-text copy](https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.txt)

If you already installed version 1.0.0, install this version once or replace the contents of the existing script with the plain-text copy. The original name and namespace are preserved, so it remains the same userscript.

If the JavaScript install link does not open your userscript manager, open the plain-text copy, paste all its contents into the manager, and save. Reload ChatGPT after installation.

## Automatic updates

Both `@updateURL` and `@downloadURL` point to the public `.user.js` file on the `main` branch. With automatic update checks enabled in your userscript manager, it can detect and install future versions according to its update settings.

To publish an update, increase `@version`, update the `.user.js` file and its identical `.user.txt` copy, and commit both to `main`. Keep the name and namespace stable. No separate scheduler or custom update code is needed.

## Behavior

- Applies to every path on the exact `chatgpt.com` host.
- Adds or replaces `oauth_return_surface` with a single `classic` value.
- Preserves other query parameter values and URL fragments.
- Loads the initial corrected URL so the server can receive the parameter.
- Retains the parameter during History API navigation, Back/Forward, and fragment changes.
- Uses a short session-storage redirect guard if the server strips the parameter repeatedly. If storage is blocked, that guard is unavailable.

The script controls the URL parameter; ChatGPT determines what effect that parameter has on its interface.

## Changes in 1.0.1

- Publish the script on GitHub.
- Add the homepage, update, and download URLs.
- Preserve the behavior of version 1.0.0.

## References

- [Tampermonkey update metadata](https://www.tampermonkey.net/documentation.php?locale=en&q=update_url)
- [Violentmonkey metadata](https://violentmonkey.github.io/api/metadata-block/)
