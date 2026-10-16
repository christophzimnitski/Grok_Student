# Grok Student

An iPhone app that turns the phone into a small AI chat server. The app runs a
web server on the phone, and any computer on the same Wi-Fi network can open
the chat page in a browser. Messages are sent to the Groq or Gemini API using
the API key saved on the phone.

## Features

- Chat web page served from the phone at `http://<phone-ip>:8080`
- Choose between Groq (Llama 3.3 70B) and Gemini
- API keys are stored in the iOS Keychain, never in the code
- Markdown, math (KaTeX), and code highlighting in replies
- Image and file uploads (Gemini)
- Light and dark themes
- Keeps running in the background while the screen is off

## How it works

- `GrokServer.mm` runs the web server (GCDWebServer), keeps the chat history,
  and forwards each message to the selected API.
- `ViewController.mm` is the on-phone screen: start and stop the server, pick
  the API, and enter API keys.
- `KeychainHelper.mm` saves and loads API keys from the Keychain.
- `Web/` contains the chat page (HTML, CSS, and JavaScript modules).

## Building

Requires a Mac with Xcode and CocoaPods.

```bash
pod install
open "Grok Student.xcworkspace"
```

Simulator builds work as is. To run on a real iPhone, create a file named
`Signing.local.xcconfig` next to `Signing.xcconfig` with your Apple team ID:

```
DEVELOPMENT_TEAM = YOUR_TEAM_ID
```

That file is ignored by git.

## Using it

1. Start the app and enter a Groq or Gemini API key.
2. Start the server. The app shows the address to open.
3. On a computer on the same Wi-Fi, open that address in a browser.

## License

MIT. See [LICENSE](LICENSE).

Bundled libraries keep their own licenses: GCDWebServer (BSD), marked (MIT),
KaTeX (MIT), and highlight.js (BSD 3-Clause).
