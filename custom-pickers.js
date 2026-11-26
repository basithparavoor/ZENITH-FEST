/**
 * ============================================================================
 * FESTOS ULTRA-PREMIUM CUSTOM PICKERS & SELECT CONTROLLER
 * Faithful recreation of Material Emerald Calendar, Time Picker & Custom Dropdowns
 * ============================================================================
 */

(function(window) {
    'use strict';

    const MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const MONTHS_SHORT = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const DAYS_HEADER = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // State for Date Picker
    const DP_STATE = {
        activeInput: null,
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth(), // 0 - 11
        selectedDate: new Date(),
        isOpen: false,
        activePopover: null // 'month' or 'year' or null
    };

    // State for Time Picker
    const TP_STATE = {
        activeInput: null,
        mode: 'hour', // 'hour' or 'minute'
        hour: 11,     // 1 - 12
        minute: 45,   // 0 - 59
        period: 'PM', // 'AM' or 'PM'
        isOpen: false,
        isDragging: false
    };

    // State for Custom Select Dropdown
    const SELECT_STATE = {
        activeTrigger: null,
        activeSelect: null,
        isOpen: false
    };

    // Shared DOM containers
    let backdropEl = null;
    let floatingSelectMenuEl = null;

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

    function initFloatingSelectMenu() {
        if (floatingSelectMenuEl) return;
        floatingSelectMenuEl = document.createElement('div');
        floatingSelectMenuEl.id = 'festosFloatingSelectMenu';
        floatingSelectMenuEl.setAttribute('role', 'listbox');
        document.body.appendChild(floatingSelectMenuEl);

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!SELECT_STATE.isOpen) return;
            if (SELECT_STATE.activeTrigger && SELECT_STATE.activeTrigger.contains(e.target)) return;
            if (floatingSelectMenuEl.contains(e.target)) return;
            closeSelectMenu();
        }, true);

        // Reposition or close on window scroll / resize
        window.addEventListener('resize', () => {
            if (SELECT_STATE.isOpen) closeSelectMenu();
        }, { passive: true });

        window.addEventListener('scroll', (e) => {
            if (SELECT_STATE.isOpen && !floatingSelectMenuEl.contains(e.target)) {
                closeSelectMenu();
            }
        }, { passive: true, capture: true });

        // Close on Esc key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (SELECT_STATE.isOpen) {
                    closeSelectMenu();
                } else if (DP_STATE.isOpen || TP_STATE.isOpen) {
                    closeAllPickers();
                }
            }
        });
    }

    function closeAllPickers() {
        if (backdropEl) {
            backdropEl.classList.remove('show');
        }
        DP_STATE.isOpen = false;
        TP_STATE.isOpen = false;
        DP_STATE.activeInput = null;
        TP_STATE.activeInput = null;
        DP_STATE.activePopover = null;
    }

    // =========================================================================
    // 1. DATE PICKER CONTROLLER (Matching Attached Image 1)
    // =========================================================================
    function openDatePicker(inputEl) {
        initBackdrop();
        DP_STATE.activeInput = inputEl;
        DP_STATE.isOpen = true;
        DP_STATE.activePopover = null;

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

        // Calculate days grid
        const firstDayIdx = new Date(DP_STATE.currentYear, DP_STATE.currentMonth, 1).getDay(); // 0 = SUN
        const daysInCurrentMonth = new Date(DP_STATE.currentYear, DP_STATE.currentMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(DP_STATE.currentYear, DP_STATE.currentMonth, 0).getDate();

        let daysHtml = '';

        // Previous month fill days
        for (let i = firstDayIdx - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const padNum = String(dayNum).padStart(2, '0');
            const isSun = (firstDayIdx - 1 - i) % 7 === 0;
            daysHtml += `
                <div class="festos-dp-day-cell other-month ${isSun ? 'sun' : ''}" 
                     onclick="window.festosPickOtherMonthDate(-1, ${dayNum})">
                    ${padNum}
                </div>
            `;
        }

        // Current month days
        for (let d = 1; d <= daysInCurrentMonth; d++) {
            const dayOfWeek = (firstDayIdx + d - 1) % 7;
            const isSun = dayOfWeek === 0;
            const isSelected = (DP_STATE.currentYear === selY && DP_STATE.currentMonth === selM && d === selD);
            const padNum = String(d).padStart(2, '0');

            let extraClasses = '';
            if (isSelected) extraClasses += ' selected';
            if (isSun) extraClasses += ' sun';

            daysHtml += `
                <div class="festos-dp-day-cell ${extraClasses}" 
                     onclick="window.festosSelectDay(${d})"
                     ondblclick="window.festosConfirmDate()">
                    ${padNum}
                </div>
            `;
        }

        // Next month fill days
        const totalRendered = firstDayIdx + daysInCurrentMonth;
        const remaining = (7 - (totalRendered % 7)) % 7;
        for (let n = 1; n <= remaining; n++) {
            const padNum = String(n).padStart(2, '0');
            const isSun = (totalRendered + n - 1) % 7 === 0;
            daysHtml += `
                <div class="festos-dp-day-cell other-month ${isSun ? 'sun' : ''}" 
                     onclick="window.festosPickOtherMonthDate(1, ${n})">
                    ${padNum}
                </div>
            `;
        }

        // Month popover items
        const monthPopoverHtml = MONTHS_SHORT.map((mShort, idx) => {
            const isSel = idx === DP_STATE.currentMonth;
            return `
                <div class="festos-dp-popover-item ${isSel ? 'selected' : ''}" onclick="window.festosSetMonth(${idx})">
                    <span>${mShort}</span>
                    ${isSel ? '<svg class="festos-select-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </div>
            `;
        }).join('');

        // Year popover items (current year - 12 to current year + 12)
        const yearsList = [];
        const baseYear = DP_STATE.currentYear;
        for (let y = baseYear - 12; y <= baseYear + 12; y++) {
            yearsList.push(y);
        }

        const yearPopoverHtml = yearsList.map(y => {
            const isSel = y === DP_STATE.currentYear;
            return `
                <div class="festos-dp-popover-item ${isSel ? 'selected' : ''}" onclick="window.festosSetYear(${y})">
                    <span>${y}</span>
                    ${isSel ? '<svg class="festos-select-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </div>
            `;
        }).join('');

        const selectedDayFormatted = String(DP_STATE.selectedDate.getDate()).padStart(2, '0');
        const currentMonthName = MONTHS_SHORT[DP_STATE.currentMonth];

        host.innerHTML = `
            <div class="festos-datepicker-card">
                <!-- Top Bar: Select Date & Month/Year Pills on Left, Badge on Right -->
                <div class="festos-dp-top-bar">
                    <div class="festos-dp-header-left">
                        <h3 class="festos-dp-title">Select Date</h3>
                        <div class="festos-dp-selectors">
                            <!-- Month Pill Button -->
                            <div class="festos-dp-pill-wrap">
                                <button type="button" class="festos-dp-pill-btn ${DP_STATE.activePopover === 'month' ? 'active' : ''}" onclick="window.festosToggleMonthPopover(event)">
                                    <span>${currentMonthName}</span>
                                    <svg viewBox="0 0 24 24" class="festos-dp-chevron"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </button>
                                <div class="festos-dp-popover" id="festosDpMonthPopover" style="display: ${DP_STATE.activePopover === 'month' ? 'block' : 'none'};">
                                    ${monthPopoverHtml}
                                </div>
                            </div>

                            <!-- Year Pill Button -->
                            <div class="festos-dp-pill-wrap">
                                <button type="button" class="festos-dp-pill-btn ${DP_STATE.activePopover === 'year' ? 'active' : ''}" onclick="window.festosToggleYearPopover(event)">
                                    <span>${DP_STATE.currentYear}</span>
                                    <svg viewBox="0 0 24 24" class="festos-dp-chevron"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </button>
                                <div class="festos-dp-popover" id="festosDpYearPopover" style="display: ${DP_STATE.activePopover === 'year' ? 'block' : 'none'};">
                                    ${yearPopoverHtml}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Side: 3D Glossy Calendar Badge (Image 1) -->
                    <div class="festos-dp-header-right">
                        <div class="festos-dp-badge">
                            <span class="festos-badge-ring ring-left"></span>
                            <span class="festos-badge-ring ring-right"></span>
                            <span class="festos-dp-badge-day" id="festosDpBadgeDay">${selectedDayFormatted}</span>
                        </div>
                    </div>
                </div>

                <!-- Weekdays Header Row -->
                <div class="festos-dp-weekdays">
                    ${DAYS_HEADER.map((dName, i) => `<div class="festos-dp-weekday ${i === 0 ? 'sun' : ''}">${dName}</div>`).join('')}
                </div>

                <!-- Days of Month Grid -->
                <div class="festos-dp-days-grid">
                    ${daysHtml}
                </div>

                <!-- Full-Width Green Confirm Button -->
                <button type="button" class="festos-dp-confirm-btn" onclick="window.festosConfirmDate()">
                    Confirm
                </button>
            </div>
        `;
    }

    window.festosToggleMonthPopover = function(e) {
        if (e) e.stopPropagation();
        DP_STATE.activePopover = DP_STATE.activePopover === 'month' ? null : 'month';
        renderDatePicker();
    };

    window.festosToggleYearPopover = function(e) {
        if (e) e.stopPropagation();
        DP_STATE.activePopover = DP_STATE.activePopover === 'year' ? null : 'year';
        renderDatePicker();
        if (DP_STATE.activePopover === 'year') {
            const popover = document.getElementById('festosDpYearPopover');
            const selectedItem = popover ? popover.querySelector('.selected') : null;
            if (popover && selectedItem) {
                popover.scrollTop = selectedItem.offsetTop - 60;
            }
        }
    };

    window.festosSetMonth = function(mIdx) {
        DP_STATE.currentMonth = parseInt(mIdx, 10);
        DP_STATE.activePopover = null;
        renderDatePicker();
    };

    window.festosSetYear = function(yVal) {
        DP_STATE.currentYear = parseInt(yVal, 10);
        DP_STATE.activePopover = null;
        renderDatePicker();
    };

    window.festosSelectDay = function(day) {
        DP_STATE.selectedDate = new Date(DP_STATE.currentYear, DP_STATE.currentMonth, day);
        renderDatePicker();
    };

    window.festosPickOtherMonthDate = function(monthDelta, day) {
        DP_STATE.currentMonth += monthDelta;
        if (DP_STATE.currentMonth < 0) {
            DP_STATE.currentMonth = 11;
            DP_STATE.currentYear -= 1;
        } else if (DP_STATE.currentMonth > 11) {
            DP_STATE.currentMonth = 0;
            DP_STATE.currentYear += 1;
        }
        DP_STATE.selectedDate = new Date(DP_STATE.currentYear, DP_STATE.currentMonth, day);
        renderDatePicker();
    };

    window.festosConfirmDate = function() {
        const dateObj = DP_STATE.selectedDate;
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        if (DP_STATE.activeInput) {
            DP_STATE.activeInput.value = dateStr;
            DP_STATE.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            DP_STATE.activeInput.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof DP_STATE.activeInput.onchange === 'function') {
                DP_STATE.activeInput.onchange();
            }
        }

        closeAllPickers();
    };

    // =========================================================================
    // 2. TIME PICKER CONTROLLER (Matching Emerald Card & Clock Badge)
    // =========================================================================
    function openTimePicker(inputEl) {
        initBackdrop();
        TP_STATE.activeInput = inputEl;
        TP_STATE.isOpen = true;
        TP_STATE.mode = 'hour';

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
        const displayHour = String(TP_STATE.hour).padStart(2, '0');
        const displayMin = String(TP_STATE.minute).padStart(2, '0');

        const wrapRadius = 105;
        const numberRadius = 76;

        let numbersHtml = '';
        let handAngle = 0;

        if (isHour) {
            handAngle = (TP_STATE.hour % 12) * 30;
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
            handAngle = TP_STATE.minute * 6;
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

        const currentActiveVal = isHour ? String(TP_STATE.hour) : displayMin;

        host.innerHTML = `
            <div class="festos-timepicker-card">
                <!-- Top Bar -->
                <div class="festos-tp-top-bar">
                    <div class="festos-dp-header-left">
                        <h3 class="festos-dp-title">Select Time</h3>
                        <span style="font-size: 0.85rem; font-weight: 600; color: #64748b;">Set hour, minute & period</span>
                    </div>
                    <div class="festos-tp-badge">
                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </div>
                </div>

                <!-- Digital Time Row & AM/PM Switcher -->
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

                <!-- Full-Width Green Confirm Button -->
                <button type="button" class="festos-dp-confirm-btn" onclick="window.festosConfirmTime()">
                    Confirm
                </button>
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
        if (!wrap || typeof wrap.getBoundingClientRect !== 'function') return;

        const rect = wrap.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;

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
            if (typeof TP_STATE.activeInput.onchange === 'function') {
                TP_STATE.activeInput.onchange();
            }
        }

        closeAllPickers();
    };

    // =========================================================================
    // 3. CUSTOM DROPDOWN SYSTEM (Matching Attached Image 2)
    // =========================================================================
    function enhanceAllSelects(root = document) {
        initFloatingSelectMenu();

        const selects = root.querySelectorAll('select:not(.no-custom-select):not([multiple])');
        selects.forEach(selectEl => {
            if (selectEl.dataset.festosEnhanced === 'true') return;
            enhanceSingleSelect(selectEl);
        });
    }

    function enhanceSingleSelect(selectEl) {
        if (!selectEl || selectEl.dataset.festosEnhanced === 'true') return;
        selectEl.dataset.festosEnhanced = 'true';

        // Create custom trigger element
        const trigger = document.createElement('div');
        trigger.className = 'festos-custom-select-trigger';
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        // Copy pertinent styling / sizing classes if present
        if (selectEl.id) {
            trigger.setAttribute('data-for-id', selectEl.id);
            trigger.classList.add(`festos-for-${selectEl.id}`);
        }
        if (selectEl.className) {
            const extraClasses = selectEl.className.split(/\s+/).filter(c => c && c !== 'no-custom-select');
            extraClasses.forEach(c => trigger.classList.add(`festos-from-${c}`));
        }

        // Apply width and display style from select
        if (selectEl.style.width) {
            trigger.style.width = selectEl.style.width;
        }

        const textSpan = document.createElement('span');
        textSpan.className = 'festos-select-text';
        trigger.appendChild(textSpan);

        const chevronSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        chevronSvg.setAttribute('viewBox', '0 0 24 24');
        chevronSvg.setAttribute('class', 'festos-select-chevron');
        chevronSvg.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
        trigger.appendChild(chevronSvg);

        // Update trigger text function
        function updateTriggerText() {
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            if (selectedOpt) {
                textSpan.textContent = selectedOpt.textContent || selectedOpt.text;
                if (!selectedOpt.value && selectedOpt.textContent.startsWith('—')) {
                    textSpan.classList.add('placeholder');
                } else {
                    textSpan.classList.remove('placeholder');
                }
            } else {
                textSpan.textContent = selectEl.placeholder || 'Select...';
                textSpan.classList.add('placeholder');
            }
            if (selectEl.disabled) {
                trigger.classList.add('disabled');
            } else {
                trigger.classList.remove('disabled');
            }
        }

        // Attach hook for descriptor
        selectEl._festosUpdateTrigger = updateTriggerText;
        selectEl._festosTriggerEl = trigger;

        updateTriggerText();

        // Insert trigger immediately after select
        selectEl.parentNode.insertBefore(trigger, selectEl.nextSibling);

        // Click on trigger opens/toggles floating menu
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (selectEl.disabled) return;
            toggleSelectMenu(trigger, selectEl);
        });

        // Keyboard navigation on trigger
        trigger.addEventListener('keydown', (e) => {
            if (selectEl.disabled) return;
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                toggleSelectMenu(trigger, selectEl);
            }
        });

        // Sync on native changes
        selectEl.addEventListener('change', updateTriggerText);
        selectEl.addEventListener('input', updateTriggerText);

        // Observe DOM mutations on select (options added / removed dynamically)
        const observer = new MutationObserver(() => {
            updateTriggerText();
            if (SELECT_STATE.isOpen && SELECT_STATE.activeSelect === selectEl) {
                populateFloatingMenu(selectEl);
            }
        });

        observer.observe(selectEl, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'selected']
        });
    }

    function toggleSelectMenu(triggerEl, selectEl) {
        if (SELECT_STATE.isOpen && SELECT_STATE.activeSelect === selectEl) {
            closeSelectMenu();
        } else {
            openSelectMenu(triggerEl, selectEl);
        }
    }

    function openSelectMenu(triggerEl, selectEl) {
        initFloatingSelectMenu();
        closeSelectMenu(); // Close any other open dropdown

        SELECT_STATE.activeTrigger = triggerEl;
        SELECT_STATE.activeSelect = selectEl;
        SELECT_STATE.isOpen = true;

        triggerEl.classList.add('open');
        triggerEl.setAttribute('aria-expanded', 'true');

        populateFloatingMenu(selectEl);
        positionFloatingMenu(triggerEl);

        floatingSelectMenuEl.classList.add('show');
    }

    function closeSelectMenu() {
        if (floatingSelectMenuEl) {
            floatingSelectMenuEl.classList.remove('show');
        }
        if (SELECT_STATE.activeTrigger) {
            SELECT_STATE.activeTrigger.classList.remove('open');
            SELECT_STATE.activeTrigger.setAttribute('aria-expanded', 'false');
        }
        SELECT_STATE.activeTrigger = null;
        SELECT_STATE.activeSelect = null;
        SELECT_STATE.isOpen = false;
    }

    function populateFloatingMenu(selectEl) {
        if (!floatingSelectMenuEl) return;
        floatingSelectMenuEl.innerHTML = '';

        const selectedIndex = selectEl.selectedIndex;

        Array.from(selectEl.children).forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                const groupHeader = document.createElement('div');
                groupHeader.className = 'festos-select-optgroup';
                groupHeader.textContent = child.label || child.getAttribute('label') || '';
                floatingSelectMenuEl.appendChild(groupHeader);

                Array.from(child.children).forEach(opt => {
                    renderOptionItem(opt, selectEl, selectedIndex);
                });
            } else if (child.tagName === 'OPTION') {
                renderOptionItem(child, selectEl, selectedIndex);
            }
        });
    }

    function renderOptionItem(optionEl, selectEl, selectedIndex) {
        const itemEl = document.createElement('div');
        itemEl.className = 'festos-select-option';
        itemEl.setAttribute('role', 'option');

        const isSelected = (optionEl.index === selectedIndex);
        if (isSelected) {
            itemEl.classList.add('selected');
        }

        const labelSpan = document.createElement('span');
        labelSpan.textContent = optionEl.textContent || optionEl.text;
        itemEl.appendChild(labelSpan);

        if (isSelected) {
            const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            checkSvg.setAttribute('viewBox', '0 0 24 24');
            checkSvg.setAttribute('class', 'festos-select-check');
            checkSvg.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
            itemEl.appendChild(checkSvg);
        }

        itemEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (optionEl.disabled) return;

            selectEl.selectedIndex = optionEl.index;
            selectEl.value = optionEl.value;

            // Dispatch events
            selectEl.dispatchEvent(new Event('input', { bubbles: true }));
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));

            if (typeof selectEl.onchange === 'function') {
                selectEl.onchange();
            }

            if (selectEl._festosUpdateTrigger) {
                selectEl._festosUpdateTrigger();
            }

            closeSelectMenu();
        });

        floatingSelectMenuEl.appendChild(itemEl);
    }

    function positionFloatingMenu(triggerEl) {
        if (!floatingSelectMenuEl || !triggerEl || typeof triggerEl.getBoundingClientRect !== 'function') return;

        const rect = triggerEl.getBoundingClientRect();
        const menuWidth = Math.max(rect.width, 180);

        floatingSelectMenuEl.style.width = `${menuWidth}px`;
        floatingSelectMenuEl.style.left = `${rect.left + window.scrollX}px`;

        // Calculate if menu fits below or should flip above
        const spaceBelow = window.innerHeight - rect.bottom;
        const estimatedHeight = 240;

        if (spaceBelow < estimatedHeight && rect.top > estimatedHeight) {
            // Place above trigger
            floatingSelectMenuEl.style.top = 'auto';
            floatingSelectMenuEl.style.bottom = `${window.innerHeight - rect.top - window.scrollY + 6}px`;
        } else {
            // Place below trigger
            floatingSelectMenuEl.style.bottom = 'auto';
            floatingSelectMenuEl.style.top = `${rect.bottom + window.scrollY + 6}px`;
        }
    }

    // Intercept property descriptor of HTMLSelectElement.prototype.value so programmatic updates sync automatically
    try {
        const origSelectDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        if (origSelectDescriptor && origSelectDescriptor.set) {
            Object.defineProperty(HTMLSelectElement.prototype, 'value', {
                set: function(val) {
                    origSelectDescriptor.set.call(this, val);
                    if (this._festosUpdateTrigger) {
                        this._festosUpdateTrigger();
                    }
                },
                get: function() {
                    return origSelectDescriptor.get.call(this);
                }
            });
        }
    } catch (e) {
        // Fallback for environments with strict descriptor policies
    }

    // =========================================================================
    // 4. UNIVERSAL BINDING & AUTO-ENHANCEMENT ENGINE
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

        // Prevent native mobile keyboard from popping up on custom pickers
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('input[type="date"], input[type="time"]')) {
                e.target.blur();
            }
        }, true);

        // Run initial select enhancement
        enhanceAllSelects(document.body);

        // Continuously enhance dynamically injected selects (e.g., modals, ajax tables, tab switches)
        const bodyObserver = new MutationObserver((mutations) => {
            let shouldCheck = false;
            for (const m of mutations) {
                if (m.addedNodes.length > 0) {
                    shouldCheck = true;
                    break;
                }
            }
            if (shouldCheck) {
                enhanceAllSelects(document.body);
            }
        });

        bodyObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Expose Global API
    window.festosOpenDatePicker = openDatePicker;
    window.festosOpenTimePicker = openTimePicker;
    window.festosClosePickers = closeAllPickers;
    window.festosEnhanceSelects = enhanceAllSelects;
    window.festosEnhanceSingleSelect = enhanceSingleSelect;

    // Boot hook
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindInputsToCustomPickers);
    } else {
        bindInputsToCustomPickers();
    }

})(window);
