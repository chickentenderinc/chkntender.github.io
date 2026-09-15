/*
 * Chicken Tender — in-bezel app clips
 *
 * Each .device[data-clip] holds a muted, looping, inline <video> whose sources
 * are held in data-src so nothing downloads until the phone is near the
 * viewport. From there:
 *
 *   - the clip plays through once when it is meaningfully on screen, holds on
 *     its last frame, and pauses if it scrolls away before finishing (no play
 *     button, no click required — desktop and mobile alike);
 *   - clicking or tapping a phone replays it from the top, on every device;
 *   - if autoplay is refused (iOS Low Power Mode, data saver, some desktop
 *     settings) or the visitor prefers reduced motion, the poster stays put
 *     behind a real play button.
 */
(function () {
    'use strict';

    var devices = Array.prototype.slice.call(document.querySelectorAll('[data-clip]'));
    if (!devices.length) return;

    var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    devices.forEach(function (device) {
        var video = device.querySelector('video');
        var playBtn = device.querySelector('.device-play');
        var hint = device.querySelector('.device-hint');
        if (!video) return;

        if (hint) hint.textContent = canHover ? 'Click to replay' : 'Tap to replay';

        var loaded = false;
        var wantsToPlay = false;

        function load() {
            if (loaded) return;
            loaded = true;
            var sources = video.querySelectorAll('source[data-src]');
            for (var i = 0; i < sources.length; i++) {
                sources[i].src = sources[i].getAttribute('data-src');
            }
            video.load();
        }

        function play(fromStart) {
            load();
            wantsToPlay = true;
            if (fromStart) {
                try { video.currentTime = 0; } catch (e) { /* not seekable yet */ }
            }
            var p = video.play();
            if (p && typeof p.catch === 'function') {
                p.catch(function () {
                    // Autoplay refused — fall back to an explicit play button.
                    if (wantsToPlay) device.classList.add('needs-tap');
                });
            }
        }

        function pause() {
            wantsToPlay = false;
            if (!video.paused) video.pause();
        }

        video.addEventListener('playing', function () {
            device.classList.remove('needs-tap', 'is-idle');
        });
        video.addEventListener('pause', function () {
            device.classList.add('is-idle');
        });
        // Browsers fire pause before ended, but the replay hint hangs off this
        // state, so set it from the event that actually means "finished" too.
        video.addEventListener('ended', function () {
            device.classList.add('is-idle');
        });

        // --- Autoplay / pause on scroll -------------------------------------
        if ('IntersectionObserver' in window) {
            // Start fetching a little before the phone reaches the viewport.
            new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) load();
                });
            }, { rootMargin: '400px 0px' }).observe(device);

            if (!reduceMotion) {
                new IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting) {
                            play(false);
                        } else {
                            pause();
                        }
                    });
                }, { threshold: 0.4 }).observe(device);
            } else {
                device.classList.add('needs-tap');
            }
        } else {
            // No IntersectionObserver (very old browsers): just load and play.
            if (reduceMotion) {
                device.classList.add('needs-tap');
            } else {
                play(false);
            }
        }

        // --- Replay affordance ----------------------------------------------
        device.addEventListener('click', function () {
            if (device.classList.contains('needs-tap')) return; // handled by the button
            play(true);
        });

        if (playBtn) {
            playBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                device.classList.remove('needs-tap');
                play(true);
            });
        }
    });

    // --- iOS: re-settle the clip after the page has been backgrounded --------
    //
    // Each clip is a composited layer (.device-screen is promoted with
    // translateZ(0) so the rounded corners clip a playing video cleanly). iOS
    // Safari can tear that layer down when the tab goes to the background and
    // rebuild it at the wrong scale on the way back, which shows up as the clip
    // zoomed into the middle of the phone. Re-resolving object-fit forces the
    // element to lay its video box out again, which rebuilds the layer.
    function resettle() {
        devices.forEach(function (device) {
            var video = device.querySelector('video');
            if (!video || !video.currentSrc) return;   // nothing loaded yet
            video.style.objectFit = 'fill';
            void video.offsetHeight;                   // flush between the writes
            video.style.objectFit = '';
        });
    }

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) resettle();
    });
    // Back/forward cache restores do not fire visibilitychange.
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) resettle();
    });
})();
