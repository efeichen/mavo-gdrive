# mavo-gdrive
Google Drive Backend for [Mavo](https://github.com/mavoweb/mavo).

(Maybe add a GIF of working with the backend enabled here?)

The backend supports:

1. Updating uploaded files.

## Usage
How to use this backend in your Mavo web application.

### Prerequisites

### Method 1: Share Link

### Method 2: File Path

### Example

```html
<main mv-app="gdriveExample" mv-storage="gdrive/Mavo Apps/Example App/storage.json">
    <h1 property="title">Title</h1>
    <ul>
        <li property="country" mv-multiple>
            <span property="code">Code</span>
            <span property="name">Name</span>
        </li>
    </ul>
    <img property="avatar" src="http://mavo.io/logo.svg"/>
</main>
```

## Dev Setup Instructions
How to set up a copy of this project on your local machine for development and testing. Make sure you have a **Google account with Google Drive set up**. 

### Installing
1. Clone the repository.
2. Enable ESLint with `npm install -g eslint` **(recommended)**.

### Testing
Use `test.html` or other Mavo apps for testing. In `test.html`, the `<script>` tag that links the backend JS is already there. Make sure to add that to test the local version of the Google Drive backend.

## API Reference

## Contribute

## Credits

## License


