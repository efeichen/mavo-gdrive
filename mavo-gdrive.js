(function($, $$) {

var _ = Mavo.Backend.register($.Class({
    extends: Mavo.Backend,
    id: "Gdrive",

    constructor: function() {
        console.log(this.mavo.id);
        this.permissions.on(["login", "read"]);

        this.key = this.mavo.element.getAttribute("mv-gdrive-key") || "447389063766-ipvdoaoqdds9tlcmr8pjdo5oambcj7va.apps.googleusercontent.com";
        this.apiKey = "AIzaSyDBWvgHl_cvr-ZVW-_6DXznAHS4WHooTCo"; // to make API calls without authentication
        this.extension = this.format.constructor.extensions[0] || ".json";
        this.info = this.parseSource(this.source);

        this.login(true);
    },

    update: function(url, o) {
        this.super.update.call(this, url, o);

        this.info = this.parseSource(this.source);
    },

    get: function() {
        if (this.info.fileid) {
            return this.request(`drive/v3/files/${this.info.fileid}`, {alt: "media", key: this.apiKey});
        }
        else if (this.info.filename) {
            // ISSUE: Should also query the file is in what folder for extra assurance.
            return this.request("drive/v3/files", {q: `name='${this.info.filename}' and trashed=false`, orderBy: "recency", fields: "*"})
                .then(info => this.request(`drive/v3/files/${info.files[0].id}`, {alt: "media", key: this.apiKey}));
        }

        // Should return a promise that resolves to the data as a string or object
    },

    // Low-level saving code.
    // serialized: Data serialized according to this.format
    // path: Path to store data
    // o: Arbitrary options
    put: function(serialized, path = this.path, o = {}) {
        // Returns promise
    },

    // If your backend supports uploads, this is mandatory.
    // file: File object to be uploaded
    // path: relative path to store uploads (e.g. "images")
    upload: function(file, path) {
        // Upload code. Should call this.put()
    },

    oAuthParams: () => `&scope=https://www.googleapis.com/auth/drive&redirect_uri=${encodeURIComponent("http://localhost:8001")}&response_type=code`,

    getUser: function() {
        if (this.user) {
            return Promise.resolve(this.user);
        }
        
        return this.request("drive/v3/about", {fields: "user"})
            .then(info => {
                this.user = {
                    username: info.user.emailAddress,
                    name: info.user.displayName,
                    avatar: info.user.photoLink,
                    info
                };

                $.fire(this.mavo.element, "mv-login", { backend: this });
            });
    },

    login: function(passive) {
        return this.oAuthenticate(passive)
            .then(() => this.getUser())
            .catch(xhr => {
				if (xhr.status == 401) {
					this.logout();
				}
			})
            .then(() => {
                if (this.user) {
                    this.permissions.logout = true;

                    this.permissions.on(["edit", "save"]);
                }
            });
            // .then(response => {
            //     // Need to check if the user has edit permission to the storage file.
            //     var fileMeta = response.files[0];
            //     if (fileMeta === undefined) {
            //         this.request("drive/v3/files", {name: `${this.mavo.id}${this.extension}`}, "POST")
            //             .then(info => {
            //                 console.log(info);
            //             })
            //             .catch(() => {
            //                 console.log("NANI!?");
            //             });
            //     }
            //     else {

            //     }

            // });
    },

/*     create: function(body) {
        var data = JSON.stringify(body);
        return $.fetch(`${_.apiDomain}drive/v3/files`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Bearer ${this.accessToken}`
            },
            data
        });
    },
 */
    logout: function() {
        return this.oAuthLogout();
    },

    parseSource: function(url) {
        var arr = url.split("/");
        var ret = {};

        if (url.startsWith("gdrive")) {
            var filename = arr[arr.length-1].indexOf(this.extension) !== -1 ? arr[arr.length-1] : `${this.mavo.id}${this.extension}`;
            // TODO: insert file path
            ret.filename = filename;
        }
        else {
            ret.fileid = url.substring(
                url.indexOf("/d/") + 3,
                url.lastIndexOf("/")
            );
        }
        
        return ret;
    },

    static: {
        apiDomain: "https://www.googleapis.com/",
        oAuth: "https://accounts.google.com/o/oauth2/v2/auth",
        // Mandatory and very important! This determines when your backend is used.
        // value: The mv-storage/mv-source/mv-init value
        test: function (url) {
            if (url.indexOf("gdrive") !== -1 || url.startsWith("https://drive.google.com")) {
                return url;
            }
            else {
                return false;
            }
        }
    }
}));
    
})(Bliss, Bliss.$);