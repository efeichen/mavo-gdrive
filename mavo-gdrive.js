(function($, $$) {

var _ = Mavo.Backend.register($.Class({
    extends: Mavo.Backend,
    id: "Gdrive",

    constructor: function() {
        this.permissions.on(["login", "read"]);

        this.key = this.mavo.element.getAttribute("mv-gdrive-key") || "447389063766-ipvdoaoqdds9tlcmr8pjdo5oambcj7va.apps.googleusercontent.com";
        this.apiKey = "AIzaSyDBWvgHl_cvr-ZVW-_6DXznAHS4WHooTCo"; // to make public API calls. POTENTIAL SECURITY FLAW!
        this.extension = this.format.constructor.extensions[0] || ".json";
        this.fileFields = "name, id, mimeType, parents, capabilities";
        this.info = this.parseSource(this.source);
        
        this.login(true);
    },

    update: function(url, o) {
        this.super.update.call(this, url, o);

        this.info = this.parseSource(this.source);
    },

    get: function() {
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
            .then(resp => this.request(`${resp.getResponseHeader("location")}&fields=*`, serialized, "PUT"))
            .then(info => this.request(`drive/v3/files/${info.id}`, {fields: "webContentLink"}))
            .then(info => info.webContentLink);
    },

    upload: function(content, path) {
        var pathInfo = path.split("/");
        var foldername = pathInfo[0];
        var uploadname = pathInfo[pathInfo.length-1];

        return this.request("drive/v3/files", {q: `name='${foldername}' and mimeType='application/vnd.google-apps.folder' and '${this.info.parents[0]}' in parents and trashed=false`, fields: "files/id"})
            .then(result => {
                var folderId = !result.files[0] ? null : result.files[0].id;

                if (result.files.length === 0) {
                    // If no folder found, create one and put file in there.
                    return this.request("drive/v3/files", {name: foldername, mimeType: "application/vnd.google-apps.folder", parents:[this.info.parents[0]]}, "POST")
                        .then(folder => this.put(content, null, {
                            meta: {
                                name: uploadname,
                                parents: [folder.id]
                            }
                        }));
                }
                else {
                    // If folder found, search for the file in the folder.
                    return this.request("drive/v3/files", {q: `name='${uploadname}' and '${folderId}' in parents and trashed=false`, fields: "files/id"})
                        .then(result => {
                            var fileExists = !!result.files[0];
                            var meta = {
                                name : uploadname,
                            };
                            meta[fileExists ? "addParents" : "parents"] = fileExists ? folderId : [folderId];

                            return this.put(content, fileExists ? result.files[0].id : null, {
                                meta: meta
                            });
                        });
                }
            });
    },

    oAuthParams: () => `&scope=https://www.googleapis.com/auth/drive&redirect_uri=${encodeURIComponent("http://localhost:8001")}&response_type=code`,

    // Set the storage file and its path
    setStorage: async function() {
        var parentId = "root";

        for (const foldername of this.info.ancestorNames) {
            const folderResult = await this.request("drive/v3/files", {q: `name='${foldername}' and trashed=false and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents`, fields: "files/id"});
            var info = "";

            if (folderResult.files.length === 0) {
                info = await this.request("drive/v3/files", {name: foldername, mimeType: "application/vnd.google-apps.folder", parents: [parentId]}, "POST");
            }
            else {
                info = folderResult.files[0];
            }

            parentId = info.id;
        }
        
        return this.request("drive/v3/files", {q: `name='${this.info.name}' and trashed=false and '${parentId}' in parents`, fields: `files(${this.fileFields})`})
            .then(result => {
                if (result.files.length === 0) {
                    return this.request(`drive/v3/files?fields=${this.fileFields}`, {name: this.info.name, parents: [parentId]}, "POST");
                }
                else {
                    return result.files[0];
                }
            })
            // Store storage file metadata for later use
            .then(info => this.info = info);
    },

    // Set permission of authenticated, Mavo app user
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
            .then(() => {
                // Check whether mv-storage/init/source contains the storage file ID via. Share Link or file path and name
                if (this.info.id) {
                    return this.request(`drive/v3/files/${this.info.id}`, {fields: this.fileFields}).then(info => this.info = info);
                }
                else {
                    return this.setStorage();
                }
            })
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

    // Extract information from mv-storage/init/source to init this.info
    parseSource: function(url) {
        var arr = url.split("/");

        if (url.startsWith("gdrive")) {
            var name = arr[arr.length-1].indexOf(this.extension) !== -1 ? arr.pop() : `${this.mavo.id}${this.extension}`;
            arr.shift();
            var ancestorNames = arr.filter(n => n !== "");
            return {
                name: name,
                ancestorNames: ancestorNames
            };
        }
        else {
            var from = "/d/";
            var to = "/";
            return {
                id: url.substring(url.indexOf(from) + from.length, url.lastIndexOf(to))
            };
        }
    },

    static: {
        apiDomain: "https://www.googleapis.com/",
        oAuth: "https://accounts.google.com/o/oauth2/v2/auth",

        test: function (url) {
            url = new URL(url, Mavo.base);
            return /drive.google.com/.test(url.host) || url.pathname.startsWith("/gdrive");
        }
    }
}));
    
})(Bliss, Bliss.$);