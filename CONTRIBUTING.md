# Want to contribute?

## Dev Setup Instructions

How to set up a copy of this project on your local machine for development and contribution. Make sure you have a **Google account with Google Drive set up**. 

1. Fork the repository.
2. Clone your forked repository: `git clone git@github.com:[username]/mavo-gdrive.git`.

## Contributing
If you wish to contribute:

1. Add new remote that points to original project: `git remote add upstream git@github.com:efeichen/mavo-gdrive.git`.
2. Create new branch from `master`: `git checkout -b [branchname] master`.
3. Install NPM (comes with [Node.js](https://nodejs.org)).
4. Install ESLint globally with `npm install -g eslint`.

## Testing
Use `test.html` or other Mavo apps for testing. In `test.html`, the `<script>` element that links the backend JS is already there. Make sure to have that to test the local version of the Google Drive backend.

## API Reference
The backend uses the Drive API by Google. Checkout their [reference page](https://developers.google.com/drive/api/v3/reference).