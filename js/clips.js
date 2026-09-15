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
})();
