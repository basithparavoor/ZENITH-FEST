/**
 * ============================================================================
 * FESTOS ULTRA-PREMIUM CUSTOM DATE & TIME PICKER CONTROLLER
 * Faithful recreation of Material Emerald Calendar & Radial Clock Pickers
 * ============================================================================
 */

(function(window) {
    'use strict';

    const MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const DAYS_HEADER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // State
    const DP_STATE = {
        activeInput: null,
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth(), // 0 - 11
        selectedDate: new Date(),
        isOpen: false
    };

    const TP_STATE = {
        activeInput: null,
        mode: 'hour', // 'hour' or 'minute'
        hour: 11,     // 1 - 12
        minute: 45,   // 0 - 59
        period: 'PM', // 'AM' or 'PM'
        isOpen: false,
        isDragging: false
    };

    // Shared DOM containers
    let backdropEl = null;

    function initBackdrop() {
        if (backdropEl) return;
        backdropEl = document.createElement('div');
        backdropEl.className = 'festos-picker-backdrop';
        backdropEl.id = 'festosPickerBackdrop';
        backdropEl.innerHTML = `
            <div class="festos-picker-modal" id="festosPickerModalHost"></div>
        `;

        backdropEl.addEventListener('click', (e) => {
            if (e.target === backdropEl) {
                closeAllPickers();
            }
        });

        document.body.appendChild(backdropEl);
    }

    function closeAllPickers() {
        if (backdropEl) {
            backdropEl.classList.remove('show');
        }
        DP_STATE.isOpen = false;
        TP_STATE.isOpen = false;
        DP_STATE.activeInput = null;
        TP_STATE.activeInput = null;
    }

    // =========================================================================
    // 1. DATE PICKER CONTROLLER
    // =========================================================================
    function openDatePicker(inputEl) {
        initBackdrop();
        DP_STATE.activeInput = inputEl;
        DP_STATE.isOpen = true;

        let initialDate = new Date();
        if (inputEl && inputEl.value) {
            const parts = inputEl.value.split('-');
            if (parts.length === 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const d = parseInt(parts[2], 10);
                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                    initialDate = new Date(y, m, d);
                }
            }
        }

        DP_STATE.selectedDate = new Date(initialDate);
        DP_STATE.currentYear = initialDate.getFullYear();
        DP_STATE.currentMonth = initialDate.getMonth();

        renderDatePicker();
        backdropEl.classList.add('show');
    }

    function renderDatePicker() {
        const host = document.getElementById('festosPickerModalHost');
        if (!host) return;

        const selY = DP_STATE.selectedDate.getFullYear();
        const selM = DP_STATE.selectedDate.getMonth();
        const selD = DP_STATE.selectedDate.getDate();

        const today = new Date();
        const todayY = today.getFullYear();
        const todayM = today.getMonth();
        const todayD = today.getDate();

        // Compute days
        const firstDayIdx = new Date(DP_STATE.currentYear, DP_STATE.currentMonth, 1).getDay(); // 0 is Sun
        const daysInCurrentMonth = new Date(DP_STATE.currentYear, DP_STATE.currentMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(DP_STATE.currentYear, DP_STATE.currentMonth, 0).getDate();

        let daysHtml = '';

        // Previous month fill days
        for (let i = firstDayIdx - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const isSun = (firstDayIdx - 1 - i) % 7 === 0;
            daysHtml += `<div class="festos-dp-day-cell other-month ${isSun ? 'sun' : ''}" onclick="window.festosPickOtherMonthDate(-1, ${dayNum})">${dayNum}</div>`;
        }

        // Current month days
        for (let d = 1; d <= daysInCurrentMonth; d++) {
            const dayOfWeek = (firstDayIdx + d - 1) % 7;
            const isSun = dayOfWeek === 0;
            const isSelected = (DP_STATE.currentYear === selY && DP_STATE.currentMonth === selM && d === selD);
            const isToday = (DP_STATE.currentYear === todayY && DP_STATE.currentMonth === todayM && d === todayD);

            let extraClasses = '';
            if (isSelected) extraClasses += ' selected';
            if (isSun) extraClasses += ' sun';

            daysHtml += `<div class="festos-dp-day-cell ${extraClasses}" onclick="window.festosSelectDay(${d})">${d}</div>`;
        }

        // Next month fill days to complete grid
        const totalRendered = firstDayIdx + daysInCurrentMonth;
        const remaining = (7 - (totalRendered % 7)) % 7;
        for (let n = 1; n <= remaining; n++) {
            const isSun = (totalRendered + n - 1) % 7 === 0;
            daysHtml += `<div class="festos-dp-day-cell other-month ${isSun ? 'sun' : ''}" onclick="window.festosPickOtherMonthDate(1, ${n})">${n}</div>`;
        }

        const monthsOptions = MONTHS.map((m, idx) => `
            <option value="${idx}" ${idx === DP_STATE.currentMonth ? 'selected' : ''}>${m}</option>
        `).join('');

        host.innerHTML = `
            <div class="festos-datepicker-card">
                <!-- Header: < Month Year > -->
                <div class="festos-dp-header">
                    <button type="button" class="festos-dp-nav-btn" onclick="window.festosChangeMonth(-1)" title="Previous Month">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <select class="festos-dp-month-select" onchange="window.festosSetMonth(this.value)">
                        ${monthsOptions}
                    </select>
                    <input type="number" class="festos-dp-year-input" value="${DP_STATE.currentYear}" min="1900" max="2100" onchange="window.festosSetYear(this.value)">
                    <button type="button" class="festos-dp-nav-btn" onclick="window.festosChangeMonth(1)" title="Next Month">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>

                <!-- Days of Week Header -->
                <div class="festos-dp-weekdays">
                    ${DAYS_HEADER.map((name, i) => `<div class="festos-dp-weekday ${i === 0 ? 'sun' : ''}">${name}</div>`).join('')}
                </div>

                <!-- Calendar Grid -->
                <div class="festos-dp-days-grid">
                    ${daysHtml}
                </div>

                <!-- Today & Clear Footer -->
                <div class="festos-dp-footer">
                    <button type="button" class="festos-dp-clear-btn" onclick="window.festosClearDate()" title="Clear date selection">
                        <i class="fa-solid fa-trash-can"></i> Clear
                    </button>
                    <button type="button" class="festos-dp-today-btn" onclick="window.festosPickToday()">Today</button>
                </div>
            </div>
        `;
    }

    window.festosChangeMonth = function(delta) {
        DP_STATE.currentMonth += delta;
        if (DP_STATE.currentMonth < 0) {
            DP_STATE.currentMonth = 11;
            DP_STATE.currentYear -= 1;
        } else if (DP_STATE.currentMonth > 11) {
            DP_STATE.currentMonth = 0;
            DP_STATE.currentYear += 1;
        }
        renderDatePicker();
    };

    window.festosSetMonth = function(mIndex) {
        DP_STATE.currentMonth = parseInt(mIndex, 10);
        renderDatePicker();
    };

    window.festosSetYear = function(yearVal) {
        const y = parseInt(yearVal, 10);
        if (!isNaN(y) && y >= 1900 && y <= 2100) {
            DP_STATE.currentYear = y;
            renderDatePicker();
        }
    };

    window.festosSelectDay = function(day) {
        const chosen = new Date(DP_STATE.currentYear, DP_STATE.currentMonth, day);
        DP_STATE.selectedDate = chosen;
        applySelectedDate(chosen);
    };

    window.festosPickOtherMonthDate = function(monthDelta, day) {
        window.festosChangeMonth(monthDelta);
        window.festosSelectDay(day);
    };

    window.festosPickToday = function() {
        const today = new Date();
        DP_STATE.currentYear = today.getFullYear();
        DP_STATE.currentMonth = today.getMonth();
        DP_STATE.selectedDate = today;
        applySelectedDate(today);
    };

    window.festosClearDate = function() {
        if (DP_STATE.activeInput) {
            DP_STATE.activeInput.value = '';
            DP_STATE.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            DP_STATE.activeInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closeAllPickers();
    };

    function applySelectedDate(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        if (DP_STATE.activeInput) {
            DP_STATE.activeInput.value = dateStr;
            DP_STATE.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            DP_STATE.activeInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        closeAllPickers();
    }

    // =========================================================================
    // 2. TIME PICKER CONTROLLER (Radial Clock Matching Image 2)
    // =========================================================================
    function openTimePicker(inputEl) {
        initBackdrop();
        TP_STATE.activeInput = inputEl;
        TP_STATE.isOpen = true;
        TP_STATE.mode = 'hour';

        // Parse initial value if present (e.g., "14:30" or "09:15" or "11:45 PM")
        let h = 11;
        let m = 45;
        let p = 'PM';

        if (inputEl && inputEl.value) {
            const raw = inputEl.value.trim();
            const match24 = raw.match(/^(\d{1,2}):(\d{2})$/);
            const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);

            if (match24) {
                let hour24 = parseInt(match24[1], 10);
                m = parseInt(match24[2], 10);
                if (hour24 >= 12) {
                    p = 'PM';
                    h = hour24 === 12 ? 12 : hour24 - 12;
                } else {
                    p = 'AM';
                    h = hour24 === 0 ? 12 : hour24;
                }
            } else if (match12) {
                h = parseInt(match12[1], 10);
                m = parseInt(match12[2], 10);
                if (match12[3]) p = match12[3].toUpperCase();
            }
        }

        TP_STATE.hour = h || 11;
        TP_STATE.minute = isNaN(m) ? 45 : m;
        TP_STATE.period = p || 'PM';

        renderTimePicker();
        backdropEl.classList.add('show');
    }

    function renderTimePicker() {
        const host = document.getElementById('festosPickerModalHost');
        if (!host) return;

        const isHour = TP_STATE.mode === 'hour';
        const displayHour = String(TP_STATE.hour);
        const displayMin = String(TP_STATE.minute).padStart(2, '0');

        // Clock calculations
        // Center of 220px wrap is (110, 110)
        // Radius of circle is 80px
        const wrapRadius = 110;
        const numberRadius = 80;

        let numbersHtml = '';
        let handAngle = 0;

        if (isHour) {
            // 12 hours: 1 to 12
            handAngle = (TP_STATE.hour % 12) * 30; // 30 deg per hour
            for (let i = 1; i <= 12; i++) {
                const angleRad = (i * 30 - 90) * (Math.PI / 180);
                const x = wrapRadius + numberRadius * Math.cos(angleRad);
                const y = wrapRadius + numberRadius * Math.sin(angleRad);
                const isActive = (i === TP_STATE.hour);
                numbersHtml += `
                    <div class="festos-tp-clock-number ${isActive ? 'active' : ''}" 
                         style="left: ${x}px; top: ${y}px;"
                         onclick="window.festosSelectClockHour(${i})">
                        ${i}
                    </div>
                `;
            }
        } else {
            // Minutes: 0, 5, 10, ... 55
            handAngle = TP_STATE.minute * 6; // 6 deg per minute
            for (let i = 0; i < 60; i += 5) {
                const angleRad = (i * 6 - 90) * (Math.PI / 180);
                const x = wrapRadius + numberRadius * Math.cos(angleRad);
                const y = wrapRadius + numberRadius * Math.sin(angleRad);
                const isActive = (i === Math.floor(TP_STATE.minute / 5) * 5);
                numbersHtml += `
                    <div class="festos-tp-clock-number ${isActive ? 'active' : ''}" 
                         style="left: ${x}px; top: ${y}px;"
                         onclick="window.festosSelectClockMinute(${i})">
                        ${String(i).padStart(2, '0')}
                    </div>
                `;
            }
        }

        const currentActiveVal = isHour ? displayHour : displayMin;

        host.innerHTML = `
            <div class="festos-timepicker-card">
                <div class="festos-tp-header-label">SELECT TIME</div>

                <!-- Digital Time Row -->
                <div class="festos-tp-display-row">
                    <div class="festos-tp-digits-box">
                        <button type="button" class="festos-tp-digit-btn ${isHour ? 'active' : ''}" onclick="window.festosSetTimeMode('hour')">
                            ${displayHour}
                        </button>
                        <span class="festos-tp-colon">:</span>
                        <button type="button" class="festos-tp-digit-btn ${!isHour ? 'active' : ''}" onclick="window.festosSetTimeMode('minute')">
                            ${displayMin}
                        </button>
                    </div>

                    <div class="festos-tp-ampm-box">
                        <button type="button" class="festos-tp-ampm-btn ${TP_STATE.period === 'AM' ? 'active' : ''}" onclick="window.festosSetPeriod('AM')">AM</button>
                        <button type="button" class="festos-tp-ampm-btn ${TP_STATE.period === 'PM' ? 'active' : ''}" onclick="window.festosSetPeriod('PM')">PM</button>
                    </div>
                </div>

                <!-- Radial Clock Face -->
                <div class="festos-tp-clock-wrap" id="festosClockWrap" onmousedown="window.festosStartClockDrag(event)" ontouchstart="window.festosStartClockDrag(event)">
                    <div class="festos-tp-clock-pivot"></div>
                    <div class="festos-tp-clock-hand" style="transform: rotate(${handAngle}deg);">
                        <div class="festos-tp-hand-knob">${currentActiveVal}</div>
                    </div>
                    ${numbersHtml}
                </div>

                <!-- Actions: Clear on left, Cancel & OK on right -->
                <div class="festos-tp-footer">
                    <button type="button" class="festos-tp-action-btn festos-tp-clear-btn" onclick="window.festosClearTime()" title="Clear time selection">
                        <i class="fa-solid fa-trash-can"></i> CLEAR
                    </button>
                    <div class="festos-tp-right-actions">
                        <button type="button" class="festos-tp-action-btn" onclick="window.festosCancelTime()">CANCEL</button>
                        <button type="button" class="festos-tp-action-btn" onclick="window.festosConfirmTime()">OK</button>
                    </div>
                </div>
            </div>
        `;
    }

    window.festosSetTimeMode = function(mode) {
        TP_STATE.mode = mode;
        renderTimePicker();
    };

    window.festosSetPeriod = function(period) {
        TP_STATE.period = period;
        renderTimePicker();
    };

    window.festosSelectClockHour = function(h) {
        TP_STATE.hour = h;
        // Auto-switch to minutes mode for seamless UX
        setTimeout(() => {
            TP_STATE.mode = 'minute';
            renderTimePicker();
        }, 180);
        renderTimePicker();
    };

    window.festosSelectClockMinute = function(m) {
        TP_STATE.minute = m;
        renderTimePicker();
    };

    // Interactive Dragging on Clock Dial
    window.festosStartClockDrag = function(e) {
        TP_STATE.isDragging = true;
        festosUpdateClockByCoords(e);

        const onMove = (moveEvent) => {
            if (TP_STATE.isDragging) {
                festosUpdateClockByCoords(moveEvent);
            }
        };

        const onUp = () => {
            TP_STATE.isDragging = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);

            if (TP_STATE.mode === 'hour') {
                setTimeout(() => {
                    TP_STATE.mode = 'minute';
                    renderTimePicker();
                }, 200);
            }
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
    };

    function festosUpdateClockByCoords(e) {
        const wrap = document.getElementById('festosClockWrap');
        if (!wrap) return;

        const rect = wrap.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;

        // Angle in radians from 12 o'clock
        let angle = Math.atan2(deltaY, deltaX) + Math.PI / 2;
        if (angle < 0) angle += 2 * Math.PI;

        const deg = angle * (180 / Math.PI);

        if (TP_STATE.mode === 'hour') {
            let h = Math.round(deg / 30);
            if (h === 0) h = 12;
            TP_STATE.hour = h;
        } else {
            let m = Math.round(deg / 6);
            if (m >= 60) m = 0;
            TP_STATE.minute = m;
        }

        renderTimePicker();
    }

    window.festosClearTime = function() {
        if (TP_STATE.activeInput) {
            TP_STATE.activeInput.value = '';
            TP_STATE.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            TP_STATE.activeInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closeAllPickers();
    };

    window.festosCancelTime = function() {
        closeAllPickers();
    };

    window.festosConfirmTime = function() {
        let hour24 = TP_STATE.hour;
        if (TP_STATE.period === 'PM' && hour24 < 12) {
            hour24 += 12;
        } else if (TP_STATE.period === 'AM' && hour24 === 12) {
            hour24 = 0;
        }

        const hh = String(hour24).padStart(2, '0');
        const mm = String(TP_STATE.minute).padStart(2, '0');
        const time24Str = `${hh}:${mm}`;

        if (TP_STATE.activeInput) {
            TP_STATE.activeInput.value = time24Str;
            TP_STATE.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            TP_STATE.activeInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        closeAllPickers();
    };

    // =========================================================================
    // 3. UNIVERSAL BINDING ENGINE
    // =========================================================================
    function bindInputsToCustomPickers() {
        // Intercept clicks on all date and time inputs across document
        document.addEventListener('click', (e) => {
            const dateInput = e.target.closest('input[type="date"], input.custom-datepicker-trigger');
            if (dateInput) {
                e.preventDefault();
                e.stopPropagation();
                openDatePicker(dateInput);
                return;
            }

            const timeInput = e.target.closest('input[type="time"], input.custom-timepicker-trigger');
            if (timeInput) {
                e.preventDefault();
                e.stopPropagation();
                openTimePicker(timeInput);
                return;
            }
        }, true);

        // Also prevent mobile native keyboard or native pickers from overriding
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('input[type="date"], input[type="time"]')) {
                e.target.blur(); // Dismiss native mobile wheel picker
            }
        }, true);
    }

    // Expose API
    window.festosOpenDatePicker = openDatePicker;
    window.festosOpenTimePicker = openTimePicker;
    window.festosClosePickers = closeAllPickers;

    // Boot hook
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindInputsToCustomPickers);
    } else {
        bindInputsToCustomPickers();
    }

})(window);
