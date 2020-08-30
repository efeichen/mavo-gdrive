(function ($, $$) {

    var _ = Mavo.Backend.register($.Class({
        extends: Mavo.Backend,
        id: "Gdrive",

        constructor: function () {
            this.permissions.on(["login", "read"]);

            this.key = this.mavo.element.getAttribute("mv-gdrive-key") || "447389063766-ipvdoaoqdds9tlcmr8pjdo5oambcj7va.apps.googleusercontent.com";
            this.extension = this.format.constructor.extensions[0] || ".json";
            this.fileFields = "name, id, mimeType, parents, capabilities";
            this.info = this.parseSource(this.source);

            this.login(true);
        },

        update: function (url, o) {
            this.super.update.call(this, url, o);
        },

        /**
         * Read data from storage file
         */
        get: function () {
            // optained file ID but logged in: storage file is public
            if (this.info.id && !this.user) {
                return $.fetch(`https://cors-anywhere.herokuapp.com/https://drive.google.com/uc?id=${this.info.id}&export=download`)
                    .then(resp => resp.responseText);
            }
            else if (this.user) {
                return this.request(`drive/v3/files/${this.info.id}`, { alt: "media" });
            }
        },

        put: function (serialized, id = this.info.id, o = {}) {
            let meta = JSON.stringify(o.meta || { name: this.info.name });
            let initRequest;

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
                .then(info => $.fetch(`${_.apiDomain}drive/v3/files/${info.id}?alt=media`, {
                    headers: {
                        "Authorization": `Bearer ${this.accessToken}`,
                    },
                    responseType: "blob"
                }))
                .then(xhr => Mavo.readFile(xhr.response))
                .then(dataURL => dataURL)
        },

        upload: function (file, path = this.path) {
            // BUG: Replace media on one property should delete previous media file before uploading new one
            // BUG: Manually trashing media file in folder still makes them accessible (storage file contains their export URL)

            var pathInfo = path.split("/");
            var foldername = pathInfo[0];
            var uploadname = pathInfo[pathInfo.length - 1];

            return this.request("drive/v3/files", { q: `name='${foldername}' and mimeType='application/vnd.google-apps.folder' and '${this.info.parents[0]}' in parents and trashed=false`, fields: "files/id" })
                .then(result => {
                    var folderId = !result.files[0] ? null : result.files[0].id;

                    if (result.files.length === 0) {
                        // If no folder found, create one and put file in there.
                        return this.request("drive/v3/files", { name: foldername, mimeType: "application/vnd.google-apps.folder", parents: [this.info.parents[0]] }, "POST")
                            .then(folder => this.put(file, null, {
                                meta: {
                                    name: uploadname,
                                    parents: [folder.id]
                                }
                            }));
                    }
                    else {
                        // If folder found, search for the file in the folder.
                        return this.request("drive/v3/files", { q: `name='${uploadname}' and '${folderId}' in parents and trashed=false`, fields: "files/id" })
                            .then(result => {
                                var fileExists = !!result.files[0];
                                var meta = {
                                    name: uploadname,
                                };
                                meta[fileExists ? "addParents" : "parents"] = fileExists ? folderId : [folderId];

                                return this.put(file, fileExists ? result.files[0].id : null, {
                                    meta: meta
                                });
                            });
                    }
                });
        },

        oAuthParams: () => `&scope=https://www.googleapis.com/auth/drive&redirect_uri=${encodeURIComponent("https://auth.mavo.io")}&response_type=code`,

        // Set the storage file and its path
        setStorage: async function () {
            var parentId = "root";

            for (const foldername of this.info.ancestorNames) {
                const folderResult = await this.request("drive/v3/files", { q: `name='${foldername}' and trashed=false and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents`, fields: "files/id" });
                var info = "";

                if (folderResult.files.length === 0) {
                    info = await this.request("drive/v3/files", { name: foldername, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }, "POST");
                }
                else {
                    info = folderResult.files[0];
                }

                parentId = info.id;
            }

            return this.request("drive/v3/files", { q: `name='${this.info.name}' and trashed=false and '${parentId}' in parents`, fields: `files(${this.fileFields})` })
                .then(result => {
                    if (result.files.length === 0) {
                        return this.request(`drive/v3/files?fields=${this.fileFields}`, { name: this.info.name, parents: [parentId] }, "POST");
                    }
                    else {
                        return result.files[0];
                    }
                })
                // Store storage file metadata for later use
                .then(info => this.info = info);
        },

        // Set permission of authenticated, Mavo app user
        setPermission: async function () {
            var canEdit = this.info.capabilities ? this.info.capabilities.canEdit : false;
            var canComment = this.info.capabilities ? this.info.capabilities.canComment : false;

            if (canEdit || canComment || !this.info.id) {
                this.permissions.on(["edit", "save"]);
            }
            else {
                console.warn("Don't have edit permission");
            }
        },

        getUser: function () {
            if (this.user) {
                return Promise.resolve(this.user);
            }

            return this.request("drive/v3/about", { fields: "user" })
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

        login: function (passive) {
            return this.oAuthenticate(passive)
                .then(() => {
                    // Check whether mv-storage/init/source contains the storage file ID via. Share Link or file path and name
                    if (this.info.id) {
                        return this.request(`drive/v3/files/${this.info.id}`, { fields: this.fileFields }).then(info => this.info = info);
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

        logout: function () {
            return this.oAuthLogout();
        },

        /**
         * Extract information from mv-storage/init/source to init this.info
         * 
     * 
         * 
     * 
         * 
     * 
         * 
         * @param {String} url Value passed in mv-storage/init/source attribute
         */
        parseSource: function (url) {
            let routes = url.split("://");

            // determine whether app uses file path or shareable link to get storage file
            if (url.startsWith("gdrive://")) {
                routes = routes[1].split("/");      // routes becomes path to storage file

                // parse name of storage file; if name not specified, default to app id + extension
                const fileName = routes[routes.length - 1].indexOf(this.extension) !== -1 ?
                    routes.pop() :
                    `${this.mavo.id}${this.extension}`;

                // parse names of storage file's ancestor folders
                const ancestorNames = routes.filter(n => n !== "");

                return {
                    name: fileName,
                    ancestorNames: ancestorNames
                };
            }
            else {
                routes = routes[1].split("/");

                return {
                    id: routes[routes.length - 2]   // extract file ID from shared URL
                };
            }
        },

        static: {
            apiDomain: "https://www.googleapis.com/",
            oAuth: "https://accounts.google.com/o/oauth2/v2/auth",

            test: function (url) {
                url = new URL(url, Mavo.base);

                return /drive.google.com/.test(url.host) || url.href.startsWith("gdrive://");
            }
        }
    }));

})(Bliss, Bliss.$);