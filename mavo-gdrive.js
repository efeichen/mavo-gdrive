(function($, $$) {

var _ = Mavo.Backend.register($.Class({
    extends: Mavo.Backend,
    id: "Gdrive",

    constructor: function() {
        this.permissions.on(["login", "read"]);

        this.key = this.mavo.element.getAttribute("mv-gdrive-key") || "447389063766-ipvdoaoqdds9tlcmr8pjdo5oambcj7va.apps.googleusercontent.com";
        this.apiKey = "AIzaSyDBWvgHl_cvr-ZVW-_6DXznAHS4WHooTCo"; // to make API calls without authentication
        this.extension = this.format.constructor.extensions[0] || ".json";
        this.info = this.parseSource(this.source);
        
        console.log("appID: " + this.mavo.id);

        this.login(true);
    },

    update: function(url, o) {
        this.super.update.call(this, url, o);

        this.info = this.parseSource(this.source);
    },

    get: function() {
        // TODO: handle case when user accidently changes file name on Google Drive
        if (this.info.fileid) {
            return this.request(`drive/v3/files/${this.info.fileid}`, {alt: "media", key: this.apiKey});
        }
        else if (this.info.filename) {
            // ISSUE: Should also query the file is in what folder for extra assurance.
            // ISSUE: Should put the query object into a variable?
            return this.request("drive/v3/files", {q: `name='${this.info.filename}' and trashed=false`, orderBy: "recency", fields: "*"})
                .then(info => this.request(`drive/v3/files/${info.files[0].id}`, {alt: "media", key: this.apiKey}))
                .catch(xhr => {
                    if (xhr.status === 403) {
                        console.warn(`Can't request ${xhr.responseURL} without authentication. Please login.`);
                    }
                });
        }
    },

    put: function(serialized, path = this.path, o = {}) {
        return this.request(`upload/drive/v3/files/${this.info.fileid}?uploadType=media`, serialized, "PATCH", {
            headers: {
                "Content-Type": "application/octet-stream"
            }
        });
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
                if (!this.info.fileid) {
                    return this.request("drive/v3/files", {q: `name='${this.info.filename}' and trashed=false`, orderBy: "recency"})
                        .then(info => this.info.fileid = info.files[0] === undefined ? undefined : info.files[0].id); // Assign file ID to this.info
                }
            })
            .then(() => {
                if (this.user) {
                    this.permissions.logout = true;
                    this.setPermission();
                }
            });
    },

    setPermission: function() {
        this.request(`drive/v3/files/${this.info.fileid}`, {fields: "capabilities"})
            .then(info => {
                if (info.capabilities.canEdit || info.capabilities.canComment) {
                    this.permissions.on(["edit", "save"]);
                }
            })
            .catch(() => console.warn("Don't have permission edit permission"));
    },

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
            var from = "/d/";
            var to = "/";
            ret.fileid = url.substring(url.indexOf(from) + from.length, url.lastIndexOf(to));
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