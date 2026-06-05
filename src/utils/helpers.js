const MONTH_NAMES_VI = [
    '', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

function pad(n) { 
    return String(n).padStart(2, '0'); 
}

function secToH(s) { 
    return Math.round((s / 3600) * 100) / 100; 
}

function fmtH(h) {
    if (h === 0) return '0h';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate(); // month is 1-based
}

// Returns all working days (Mon-Sat) in a month
function buildWorkingDays(year, month) {
    const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const days = [];
    const total = getDaysInMonth(year, month);
    for (let d = 1; d <= total; d++) {
        const date = new Date(year, month - 1, d);
        const dow = date.getDay(); // 0=Sun
        if (dow === 0) continue;  // skip Sunday
        const dateStr = `${year}-${pad(month)}-${pad(d)}`;
        days.push({
            date: dateStr,
            day_label: `${pad(d)}\n${DAY_NAMES[dow]}`,
            day_name: DAY_NAMES[dow],
            dow,
            is_saturday: dow === 6,
            standard: dow === 6 ? 4 : 8,
            logged: 0
        });
    }
    return days;
}

function makeAdfComment(text) {
    if (!text) return undefined;
    return {
        type: "doc",
        version: 1,
        content: [
            {
                type: "paragraph",
                content: [
                    {
                        text: text,
                        type: "text"
                    }
                ]
            }
        ]
    };
}

module.exports = {
    MONTH_NAMES_VI,
    pad,
    secToH,
    fmtH,
    getDaysInMonth,
    buildWorkingDays,
    makeAdfComment
};
