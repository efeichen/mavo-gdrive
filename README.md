# mavo-gdrive
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Google Drive Backend for [Mavo](https://github.com/mavoweb/mavo).

(Maybe add a GIF of working with the backend enabled here?)

The backend supports:

1. Updating uploaded files (images, etc.).
2. Creating storage file via. file path in `mv-storage` attribute (details [here]()).
3. *(Coming Soon)* Adding edit suggestion to master storage data via. Comments.

## Usage
How to use this backend in your Mavo web application.

### Prerequisites
1. Google account with Google Drive set up.
2. HTML file with Mavo app(s) [defined](http://mavo.io/docs/primer#mv-app).

### Method 1: Shareable Link
1. Create and upload an empty JSON file onto a Drive folder of your preference.
2. On the top right corner, click the link icon with a tooltip that says **Get shareable link**. The link should be automatically copied to your clipboard.
3. Paste the shareable link that looks something like [https://drive.google.com/file/d/1ARoYV9VM2iBtjLIV2r4JISPES71u-QQp/view?usp=sharing](https://drive.google.com) into the `mv-storage`, `mv-source` or `mv-init` attribute, like so:

```html
<div mv-app mv-storage="https://drive.google.com/file/d/1ARoYV9VM2iBtjLIV2r4JISPES71u-QQp/view?usp=sharing">
    ...
</div>
```

*Note*: The permission is initially set to *Anyone with the link **can view*** when you enable shareable link. You can change the permission to ***can comment*** or ***can edit*** and the backend will grant the corresponding permission to other Drive users accessing your Mavo app.

### Method 2: File Path

## Dev Setup Instructions
How to set up a copy of this project on your local machine for development and testing. Make sure you have a **Google account with Google Drive set up**. 

### Installing
1. Clone the repository.
2. Install NPM (installed with [Node.js](https://nodejs.org)).
3. Install ESLint globally with `npm install -g eslint` **(optional)**.

### Testing
Use `test.html` or other Mavo apps for testing. In `test.html`, the `<script>` tag that links the backend JS is already there. Make sure to add that to test the local version of the Google Drive backend.

## API Reference

## Contribute

## Credits

## License
This project is licensed under the MIT License - see the [LICENSE](https://github.com/efeichen/mavo-gdrive/blob/master/LICENSE) file for details.