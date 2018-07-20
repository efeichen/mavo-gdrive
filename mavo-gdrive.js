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
        
        this.login(true);
    },

    update: function(url, o) {
        this.super.update.call(this, url, o);

        this.info = this.parseSource(this.source);
    },

    get: function() {
        // TODO: handle cases such as: can't find file, need login, no permission.
        if (this.info.id) {
            return this.request(`drive/v3/files/${this.info.id}`, {alt: "media", key: this.apiKey});
        }        
    },

    // May involve loop to create multiple folders.
    put: function(serialized, id = this.info.id, o = {}) {
        var meta = JSON.stringify(o.meta || {name: this.info.name});
        var initRequest;

        if (id === null) {
            initRequest = $.fetch(`${_.apiDomain}upload/drive/v3/files?uploadType=resumable`, {
                method: "POST",
                data: meta,
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json; charset=utf-8"
                }
            });
        }
        else {
            initRequest = $.fetch(`${_.apiDomain}upload/drive/v3/files/${id}?uploadType=resumable`, {
                method: "PATCH",
                data: meta,
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json; charset=utf-8"
                },
            });
        }

        return initRequest
            .then(resp => $.fetch(resp.getResponseHeader("location"), {
                method: "PUT",
                data: serialized,
            }))
            .then(info => this.request(`drive/v3/files/${JSON.parse(info.response).id}`, { fields: "*" }))
            .then(resp => resp.webContentLink);
    },

    // If your backend supports uploads, this is mandatory.
    // file: File object to be uploaded FILE = SERIALIZED = CONTENT
    // path: relative path to store uploads (e.g. "images")
    upload: function(file, path) {
        var info = path.split("/");
        var filename = info[1], foldername = info[0];
        return this.put(file); // Search how to upload file into specified folder

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
            .then(() => this.setMeta())
            .then(() => this.getUser())
            .catch(xhr => {
				if (xhr.status == 401) {
					this.logout();
				}
            })
            .then(() => {
                if (this.user) {
                    this.permissions.logout = true;
                    this.setPermission();
                }
            });
    },

    setMeta: function() {
        var query = `name='${this.info.name}' and trashed=false and mimeType contains '${this.extension.substring(1)}'`;

        if (this.info.name) {
            return this.request("drive/v3/files", {q: query, corpora: "user", spaces: "drive", orderBy: "recency", fields: "*"})
                .then(info => this.info = info.files[0] ? info.files[0] : this.info); // Assign file ID to this.info
        }
        else if (this.info.id) {
            return this.request(`drive/v3/files/${info.file.id}`, {fields: "*"}).then(info => this.info = info);
        }
    },

    setPermission: function() {
        if (this.info.capabilities.canEdit || this.info.capabilities.canComment) {
            this.permissions.on(["edit", "save"]);
        }
        else {
            console.warn("Don't have permission edit permission");
        }
    },

    logout: function() {
        return this.oAuthLogout();
    },

    parseSource: function(url) {
        var arr = url.split("/");
        var ret = {};

        if (url.startsWith("gdrive")) {
            ret.name = arr[arr.length-1].indexOf(this.extension) !== -1 ? arr.pop() : `${this.mavo.id}${this.extension}`;
        }
        else {
            var from = "/d/";
            var to = "/";
            ret.id = url.substring(url.indexOf(from) + from.length, url.lastIndexOf(to));
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