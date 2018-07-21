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

    upload: function(content, path) {
        var pathInfo = path.split("/");
        var foldername = pathInfo[0];
        var uploadname = pathInfo[pathInfo.length-1];

        return this.request("drive/v3/files", {q: `name='${foldername}' and mimeType='application/vnd.google-apps.folder' and '${this.info.parents[0]}' in parents and trashed=false`})
            .then(info => {
                var folderId = !info.files[0] ? null : info.files[0].id;

                if (info.files.length === 0) { // If no folder found, create one and put file in there.
                    return this.request("drive/v3/files", {name: foldername, mimeType: "application/vnd.google-apps.folder", parents:[this.info.parents[0]]}, "POST")
                        .then(folder => this.put(content, null, {
                            meta: {
                                name: uploadname,
                                parents: [folder.id]
                            }
                        }));
                }
                else {
                    return this.request("drive/v3/files", {q: `name='${uploadname}' and '${info.files[0].id}' in parents and trashed=false`})
                        .then(info => {
                            var meta = {
                                name : uploadname,
                            };
                            var fileExists = !!info.files[0];
                            meta[fileExists ? "addParents" : "parents"] = fileExists ? folderId : [folderId];

                            return this.put(content, fileExists ? info.files[0].id : null, {
                                meta: meta
                            });
                        });
                }
            });
    },

    oAuthParams: () => `&scope=https://www.googleapis.com/auth/drive&redirect_uri=${encodeURIComponent("http://localhost:8001")}&response_type=code`,

    setStorage: async function() {
        var parentId = "root";

        for (const foldername of this.info.ancestorNames) {
            const folderList = await this.request("drive/v3/files", {q: `name='${foldername}' and trashed=false and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents`});
            var resp = "";

            if (folderList.files.length === 0) {
                resp = await this.request("drive/v3/files", {name: foldername, mimeType: "application/vnd.google-apps.folder", parents: [parentId]}, "POST");
            }
            else {
                resp = folderList.files[0];
            }

            parentId = resp.id;
        }
        
        // Create storage file in the last folder
        return this.request("drive/v3/files", {q: `name='${this.info.name}' and trashed=false and '${parentId}' in parents`, fields: "*"})
            .then(info => {
                if (info.files.length === 0) {
                    return this.request("drive/v3/files?fields=*", {name: this.info.name, parents: [parentId]}, "POST");
                }
                else {
                    return info.files[0];
                }
            })
            .then(info => this.info = info);

        // When to use info when to use resp?
        // Set permission when creating file?
    },

    setPermission: async function() {
        var canEdit = this.info.capabilities ? this.info.capabilities.canEdit : false;
        var canComment = this.info.capabilities ? this.info.capabilities.canComment : false;

        if (canEdit || canComment || !this.info.id) {
            this.permissions.on(["edit", "save"]);
        }
        else {
            console.warn("Don't have edit permission");
        }
    },

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