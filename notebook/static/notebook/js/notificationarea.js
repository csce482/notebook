define([
    'jquery',
    'base/js/utils',
    'base/js/i18n',
    'base/js/dialog',
    'base/js/notificationarea',
    'moment'
], function($, utils, i18n, dialog, notificationarea, moment) {
    "use strict";

    
    var NotificationArea = notificationarea.NotificationArea;
    
    var NotebookNotificationArea = function(selector, options) {
        console.log("Calling from notifactionarea constructor");
        NotificationArea.apply(this, [selector, options]);
        this.save_widget = options.save_widget;
        this.notebook = options.notebook;
        this.keyboard_manager = options.keyboard_manager;
    };
    
    NotebookNotificationArea.prototype = Object.create(NotificationArea.prototype);
    
    /**
     * Initialize the default set of notification widgets.
     *
     * @method init_notification_widgets
     */
    NotebookNotificationArea.prototype.init_notification_widgets = function () {
        this.init_kernel_notification_widget();
        this.init_notebook_notification_widget();
        this.init_trusted_notebook_notification_widget();
    };

    /**
     * Initialize the notification widget for kernel status messages.
     *
     * @method init_kernel_notification_widget
     */
    NotebookNotificationArea.prototype.init_kernel_notification_widget = function () {
        var that = this;
        var knw = this.widget('kernel');
        var $kernel_ind_icon = $("#kernel_indicator_icon");
        var $modal_ind_icon = $("#modal_indicator");
        var $readonly_ind_icon = $('#readonly-indicator');
        var $body = $('body');
        var busy_favicon_timer = -1;
        
        var set_busy_favicon = function(on) {
            if (on) {
                // Only show the busy icon if execution lasts > 1s
                // This is to avoid rapidly switching icons and making lots of
                // HTTP requests.
                clearTimeout(busy_favicon_timer);
                busy_favicon_timer = setTimeout(function() {
                    utils.change_favicon('/static/base/images/favicon-busy-1.ico');
                }, 1000);
            } else {
                clearTimeout(busy_favicon_timer);
                utils.change_favicon('/static/base/images/favicon-notebook.ico');
            }
        };

        // Listen for the notebook loaded event.  Set readonly indicator.
        this.events.on('notebook_loaded.Notebook', function() {
            console.log("JACOB: notebook loaded");
            if (that.notebook.writable) {
                $readonly_ind_icon.hide();
            } else {
                $readonly_ind_icon.show();
            }
        });

        // Command/Edit mode
        this.events.on('edit_mode.Notebook', function () {
            that.save_widget.update_document_title();
            $body.addClass('edit_mode');
            $body.removeClass('command_mode');
            $modal_ind_icon.attr('title',i18n.msg._('Edit Mode'));
        });

        this.events.on('command_mode.Notebook', function () {
            that.save_widget.update_document_title();
            $body.removeClass('edit_mode');
            $body.addClass('command_mode');
            $modal_ind_icon.attr('title',i18n.msg._('Command Mode'));
        });

        // Implicitly start off in Command mode, switching to Edit mode will trigger event
        $modal_ind_icon.addClass('modal_indicator').attr('title',i18n.msg._('Command Mode'));
        $body.addClass('command_mode');

        // Kernel events

        // this can be either kernel_created.Kernel or kernel_created.Session
        this.events.on('kernel_created.Kernel kernel_created.Session', function () {
            knw.info(i18n.msg._("Kernel Created"), 500);
        });

        this.events.on('kernel_reconnecting.Kernel', function () {
            //ADD IF STATEMENT HERE
            // var that = this;
            // console.log('checkpoint enabled reconnecting kernel? ', that.kernel.checkpoint_enabled())
            knw.danger(i18n.msg._("Please wait, FastFreeze is connecting to kernel"));
        });

        this.events.on('kernel_connection_dead.Kernel', function (evt, info) {
            knw.danger(i18n.msg._("FF Error: Unable to restore kernel"), undefined, function () {
                // schedule reconnect a short time in the future, don't reconnect immediately
                //setTimeout($.proxy(info.kernel.reconnect, info.kernel), 500);
            }, {title: i18n.msg._('click to reconnect')});
        });

        this.events.on('kernel_connected.Kernel', function () {
            knw.info("Connected", 500);
            // trigger busy in the status to clear broken-link state immediately
            // a kernel_ready event will come when the kernel becomes responsive.
            $kernel_ind_icon
                .attr('class', 'kernel_busy_icon')
                .attr('title', i18n.msg._('Kernel Connected'));
        });

        this.events.on('kernel_restarting.Kernel', function () {
            that.save_widget.update_document_title();
            knw.set_message(i18n.msg._("Restarting kernel"), 2000);
        });

        this.events.on('kernel_autorestarting.Kernel', function (evt, info) {
            // Only show the dialog on the first restart attempt. This
            // number gets tracked by the `Kernel` object and passed
            // along here, because we don't want to show the user 5
            // dialogs saying the same thing (which is the number of
            // times it tries restarting).
            if (info.attempt === 1) {

                dialog.kernel_modal({
                    notebook: that.notebook,
                    keyboard_manager: that.keyboard_manager,
                    title: i18n.msg._("Kernel Restarting"),
                    body: i18n.msg._("The kernel appears to have died. It will restart automatically."),
                    buttons: {
                        OK : {
                            class : "btn-primary"
                        }
                    }
                });
            }

            that.save_widget.update_document_title();
            knw.danger(i18n.msg._("Dead kernel"));
            $kernel_ind_icon.attr('class','kernel_dead_icon').attr('title',i18n.msg._('Kernel Dead'));
        });

        this.events.on('kernel_interrupting.Kernel', function () {
            knw.set_message(i18n.msg._("Interrupting kernel"), 2000);
        });

        this.events.on('kernel_disconnected.Kernel', function () {
            //ADD IF STATEMENT HERE
            // var that = this;
            // console.log('checkpoint enabled kernel_disconnected? ', that.kernel.checkpoint_enabled())
            knw.warning(i18n.msg._("FastFreeze failed to connect to kernel"));
            $kernel_ind_icon
                .attr('class', 'kernel_disconnected_icon')
                .attr('title', i18n.msg._('No Connection to Kernel'));
        });

        this.events.on('kernel_connection_failed.Kernel', function (evt, info) {
            // only show the dialog if this is the first failed
            // connect attempt, because the kernel will continue
            // trying to reconnect and we don't want to spam the user
            // with messages
            if (info.attempt > 0) { //previously set as info.attempt === 1

                // var msg = i18n.msg._("A connection to the notebook server could not be established." +
                //         " The notebook will continue trying to reconnect. Check your" +
                //         " network connection or notebook server configuration.");
                //ADD IF STATEMENT HERE
                // var that = this;
                // console.log('checkpoint enabled  kernel_connection_failed? ', that.kernel.checkpoint_enabled())
                var msg = i18n.msg._("Connection failed. FastFreeze was not able to relaunch your previously checkpointed Kernel");

                var the_dialog = dialog.kernel_modal({
                    title: i18n.msg._("FastFreeze Error: Connection failed. FastFreeze was not able to relaunch your previously checkpointed Kernel"),
                    body: msg,
                    keyboard_manager: that.keyboard_manager,
                    notebook: that.notebook,
                    buttons : {
                        "OK": {}
                    }
                });

                // hide the dialog on reconnect if it's still visible
                var dismiss = function () {
                    the_dialog.modal('hide');
                }
                that.events.on("kernel_connected.Kernel", dismiss);
                the_dialog.on("hidden.bs.modal", function () {
                    // clear handler on dismiss
                    that.events.off("kernel_connected.Kernel", dismiss);
                });
            }
        });

        this.events.on('kernel_killed.Kernel kernel_killed.Session', function () {
            that.save_widget.update_document_title();
            knw.warning(i18n.msg._("No kernel Jacob 2"));
            $kernel_ind_icon.attr('class','kernel_busy_icon').attr('title',i18n.msg._('Kernel is not running'));
        });

        this.events.on('kernel_dead.Kernel', function () {
        // This statement is used simply so that message extraction
        // will pick up the strings.  The actual setting of the text
        // for the button is in dialog.js.
        var button_labels = [ i18n.msg._("Don't Restart"), i18n.msg._("Try Restarting Now"), i18n.msg._("OK")];

            var showMsg = function () {

                var msg = i18n.msg._('The kernel has died, and the automatic restart has failed.' +
                        ' It is possible the kernel cannot be restarted. ' +
                        'If you are not able to restart the kernel, you will still be able to save' +
                        ' the notebook, but running code will no longer work until the notebook' +
                        ' is reopened.');

                dialog.kernel_modal({
                    title: i18n.msg._("Dead kernel"),
                    body : msg,
                    keyboard_manager: that.keyboard_manager,
                    notebook: that.notebook,
                    default_button: "Don't Restart",
                    buttons : {
                        "Don't Restart": {},
                        "Try Restarting Now": {
                            class: "btn-danger",
                            click: function () {
                                that.notebook.start_session();
                            }
                        }
                    }
                });

                return false;
            };

            that.save_widget.update_document_title();
            knw.danger(i18n.msg._("Dead kernel"), undefined, showMsg);
            $kernel_ind_icon.attr('class','kernel_dead_icon').attr('title',i18n.msg._('Kernel Dead'));

            showMsg();
        });
        
        this.events.on("no_kernel.Kernel", function (evt, data) {
            $("#kernel_indicator").find('.kernel_indicator_name').text(i18n.msg._("No Kernel"));
        });

        this.events.on('kernel_dead.Session', function (evt, info) {
            //ADD IF STATEMENT HERE
            // var that = this;
            // console.log('checkpoint enabled kernel_dead? ', that.kernel.checkpoint_enabled())
            var full = info.xhr.responseJSON.message;
            var short = info.xhr.responseJSON.short_message || 'FastFreeze Error. Click me!';
            var traceback = info.xhr.responseJSON.traceback;

            var showMsg = function () {
                var msg = $('<div/>').append($('<p/>').text(full));
                var cm, cm_elem, cm_open;

                if (traceback) {
                    cm_elem = $('<div/>')
                        .css('margin-top', '1em')
                        .css('padding', '1em')
                        .addClass('output_scroll');
                    msg.append(cm_elem);
                    cm = new CodeMirror(cm_elem.get(0), {
                        mode:  "python",
                        readOnly : true
                    });
                    cm.setValue(traceback);
                    cm_open = $.proxy(cm.refresh, cm);
                }

                dialog.kernel_modal({
                    title: i18n.msg._("Failed to start the kernel"),
                    body : msg,
                    keyboard_manager: that.keyboard_manager,
                    notebook: that.notebook,
                    open: cm_open,
                    buttons : {
                        "OK": { class: 'btn-primary' }
                    }
                });

                return false;
            };

            that.save_widget.update_document_title();
            $kernel_ind_icon.attr('class','kernel_dead_icon').attr('title',i18n.msg._('Kernel Dead'));
            knw.danger(short, undefined, showMsg);
        });
        
        this.events.on('kernel_starting.Kernel kernel_created.Session', function () {
            // window.document.title='(Starting) '+window.document.title;
            console.log("JACOB: caught kernel_created event");
            console.log("JACOB: Kernel starting, please wait");
            console.log(that);
            $kernel_ind_icon.attr('class','kernel_busy_icon').attr('title',i18n.msg._('Kernel Busy'));
            knw.set_message(i18n.msg._("Kernel starting, please wait..."),500);
            //knw.info(i18n.msg._("Kernel starting, please wait..."), 5000); //i added this line
            set_busy_favicon(true);
            //setTimeout(() => console.log("first"),1000); //added this line
            //setTimeout(() => console.log("second"),2000); //added this line
        });

        this.events.on('kernel_ready.Kernel', function () {
            // that.save_widget.update_document_title();
            //ADD IF STATEMENT HERE
            console.log("Jacob: kernel_ready event is caught")
            // var that = this;
            // console.log('checkpoint enabled kernel ready? ', that.kernel.checkpoint_enabled())
            $kernel_ind_icon.attr('class','kernel_idle_icon').attr('title',i18n.msg._('Kernel Idle'));
            knw.info(i18n.msg._("FastFreeze Enabled: Kernel ready"), 500);
            set_busy_favicon(false);
        });

        //this is where the loading bar will go JACOB
        this.events.on( 'kernel_starting.Kernel kernel_created.Session', function (){
            console.log("JACOB: caight kernel_starting or kernel_created")
            //console.log(this.events)
            console.log("Loading bar function called");
            // return new Promise(function() {
            //     once
            // });

            // async function waitReady(that) {
            //     await that.events.on('kernel_ready.Kernel', function (){
            //         console.log("Loading bar done");
            //     });
            // }

            // waitReady(this);

            // that.events.on('kernel_ready.Kernel', function () {
            //     console.log("JACOB: Testing Kernel Ready wait")
            // });

            async function waitReady() {
                await that.events.on('kernel_ready.Kernel', function () {
                    console.log("JACOB: waiting for kernel to be ready")
                });
                console.log("Done: kernel ready")
                setTimeout(() => console.log("second"),2000); //added this line
            }

            waitReady().then(console.log("Loading bar function finished"));

            

        });

        this.events.on('kernel_idle.Kernel', function () {
            // that.save_widget.update_document_title();
            $kernel_ind_icon.attr('class','kernel_idle_icon').attr('title',i18n.msg._('Kernel Idle'));
            set_busy_favicon(false);
        });

        this.events.on('kernel_busy.Kernel', function () {
            // window.document.title='(Busy) '+window.document.title;
            $kernel_ind_icon.attr('class','kernel_busy_icon').attr('title',i18n.msg._('Kernel Busy'));
            set_busy_favicon(true);
        });

        this.events.on('spec_match_found.Kernel', function (evt, data) {
            that.widget('kernelspec').info(i18n.msg._("Using kernel: ") + data.found.spec.display_name, 3000, undefined, {
                title: i18n.msg.sprintf(i18n.msg._("Only candidate for language: %1$s was %2$s."),
                        data.selected.language, data.found.spec.display_name)
            });
        });

        
        // Start the kernel indicator in the busy state, and send a kernel_info request.
        // When the kernel_info reply arrives, the kernel is idle.
        $kernel_ind_icon.attr('class','kernel_busy_icon').attr('title',i18n.msg._('Kernel Busy'));
    };

    /**
     * Initialize the notification widget for notebook status messages.
     *
     * @method init_notebook_notification_widget
     */
    NotebookNotificationArea.prototype.init_notebook_notification_widget = function () {
        var nnw = this.widget('notebook');

        // Notebook events
        this.events.on('notebook_loading.Notebook', function () {
            nnw.set_message(i18n.msg._("Loading notebook"),500);
        });
        this.events.on('notebook_loaded.Notebook', function () {
            nnw.set_message(i18n.msg._("Notebook loaded"),500);
        });
        this.events.on('notebook_saving.Notebook', function () {
            nnw.set_message(i18n.msg._("Saving notebook"),500);
        });
        this.events.on('notebook_saved.Notebook', function () {
            nnw.set_message(i18n.msg._("FastFreeze: Checkpoint Created"),2000);
        });
        this.events.on('notebook_save_failed.Notebook', function (evt, error) {
            nnw.warning(error.message || i18n.msg._("Notebook save failed"));
        });
        this.events.on('notebook_copy_failed.Notebook', function (evt, error) {
            nnw.warning(error.message || i18n.msg._("Notebook copy failed"));
        });
        
        // Checkpoint events
        this.events.on('checkpoint_created.Notebook', function (evt, data) {
            //ADD IF STATEMENT HERE
            // var that = this;
            // console.log('checkpoint enabled checkpoint created? ', that.kernel.checkpoint_enabled())
            var msg = i18n.msg._("FastFreeze: Checkpoint completed");
            if (data.last_modified) {
                var d = new Date(data.last_modified);
                msg = msg + ": " + moment(d).format("HH:mm:ss");
            }
            nnw.set_message(msg, 2000);
        });
        this.events.on('checkpoint_failed.Notebook', function () {
            nnw.warning(i18n.msg._("Checkpoint failed"));
        });
        this.events.on('checkpoint_deleted.Notebook', function () {
            nnw.set_message(i18n.msg._("Checkpoint deleted"), 500);
        });
        this.events.on('checkpoint_delete_failed.Notebook', function () {
            nnw.warning(i18n.msg._("Checkpoint delete failed"));
        });
        this.events.on('checkpoint_restoring.Notebook', function () {
            nnw.set_message(i18n.msg._("Restoring to checkpoint..."), 500);
        });
        this.events.on('checkpoint_restore_failed.Notebook', function () {
            nnw.warning(i18n.msg._("Checkpoint restore failed"));
        });

        // Autosave events
        this.events.on('autosave_disabled.Notebook', function () {
            nnw.set_message(i18n.msg._("Autosave disabled"), 2000);
        });
        this.events.on('autosave_enabled.Notebook', function (evt, interval) {
            nnw.set_message(i18n.msg.sprintf(i18n.msg._("Saving every %d sec."), interval / 1000) , 1000);
        });
    };

    /**
     * Initialize the notification widget for trusted notebook messages.
     *
     * @method init_trusted_notebook_notification_widget
     */
    NotebookNotificationArea.prototype.init_trusted_notebook_notification_widget = function () {
        var that = this;
        var tnw = this.widget('trusted');

        // Notebook trust events
        this.events.on('trust_changed.Notebook', function (event, trusted) {
            if (trusted) {
                tnw.set_message(i18n.msg._("Trusted"), undefined, function() {
                  return false;
                }, {'title':'Javascript enabled for notebook display'});
                // don't allow 'Trusted' button to be clicked
                $(tnw.selector).attr('disabled', true);
                $(tnw.selector).css('cursor', 'help');
            } else {
                tnw.set_message(i18n.msg._("Not Trusted"), undefined, function() {
                  that.notebook.trust_notebook("#notification_trusted");
                  return false;
                }, {'title':'Javascript disabled for notebook display'});
                $(tnw.selector).attr('role', 'button');
            }
        });
    };

    return {'NotebookNotificationArea': NotebookNotificationArea};
});
