const STORAGE_KEY = "baby-milk-records-v1";

const form = document.querySelector("#feedForm");
const amountInput = document.querySelector("#amount");
const timeInput = document.querySelector("#feedTime");
const todayTotal = document.querySelector("#todayTotal");
const calendarView = document.querySelector("#calendarView");
const detailView = document.querySelector("#detailView");
const calendarTitle = document.querySelector("#calendarTitle");
const calendarGrid = document.querySelector("#calendarGrid");
const feedList = document.querySelector("#feedList");
const detailDateLabel = document.querySelector("#detailDateLabel");
const selectedDayTotal = document.querySelector("#selectedDayTotal");
const statusMessage = document.querySelector("#statusMessage");
const clearTodayButton = document.querySelector("#clearToday");
const clearSelectedDayButton = document.querySelector("#clearSelectedDay");
const backToCalendarButton = document.querySelector("#backToCalendar");
const prevMonthButton = document.querySelector("#prevMonth");
const nextMonthButton = document.querySelector("#nextMonth");
const emptyStateTemplate = document.querySelector("#emptyStateTemplate");

let canPersistRecords = true;
let records = loadRecords();
let visibleMonth = startOfMonth(new Date());
let selectedDateKey = dateKey(new Date());
let timeWasEdited = false;
let editingRecordId = "";

function loadRecords() {
  try {
    const saved = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    canPersistRecords = false;
    return [];
  }
}

function saveRecords() {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(records));
    canPersistRecords = true;
  } catch {
    canPersistRecords = false;
    showStatus("当前打开方式不能长期保存，记录会先保留在这个页面里。建议用浏览器打开。");
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showStatus(message) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.hidden = false;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setCurrentTimeInput(force = false) {
  if (force || (!timeWasEdited && !amountInput.value)) {
    timeInput.value = toLocalInputValue();
  }
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatDay(key) {
  const date = dateFromKey(key);
  const label = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
  return key === dateKey(new Date()) ? `今天，${label}` : label;
}

function formatTime(iso) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function groupedByDay() {
  return records.reduce((groups, record) => {
    const key = dateKey(new Date(record.time));
    groups[key] ||= { total: 0, count: 0, records: [] };
    groups[key].total += record.amount;
    groups[key].count += 1;
    groups[key].records.push(record);
    return groups;
  }, {});
}

function renderEmpty(target) {
  const emptyState = emptyStateTemplate.content.cloneNode(true);
  if (target.tagName === "OL" || target.tagName === "UL") {
    const item = document.createElement("li");
    item.append(emptyState);
    target.replaceChildren(item);
    return;
  }
  target.replaceChildren(emptyState);
}

function showCalendar() {
  form.hidden = false;
  calendarView.hidden = false;
  calendarView.classList.add("active");
  detailView.hidden = true;
  detailView.classList.remove("active");
}

function showDetail(key) {
  selectedDateKey = key;
  const selectedDate = dateFromKey(key);
  if (!sameMonth(visibleMonth, selectedDate)) {
    visibleMonth = startOfMonth(selectedDate);
  }
  form.hidden = true;
  calendarView.hidden = true;
  calendarView.classList.remove("active");
  detailView.hidden = false;
  detailView.classList.add("active");
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCalendar(groups) {
  const todayKey = dateKey(new Date());
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingEmptyDays = (new Date(year, month, 1).getDay() + 6) % 7;

  calendarTitle.textContent = formatMonth(visibleMonth);
  calendarGrid.replaceChildren();

  for (let index = 0; index < leadingEmptyDays; index += 1) {
    const empty = document.createElement("span");
    empty.className = "day-row empty";
    calendarGrid.append(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(new Date(year, month, day));
    const group = groups[key];
    const button = document.createElement("button");
    button.className = [
      "day-row",
      key === todayKey ? "today" : "",
      key === selectedDateKey ? "selected" : "",
      group ? "has-record" : "",
    ].filter(Boolean).join(" ");
    button.type = "button";
    button.dataset.date = key;
    button.setAttribute("aria-label", `${formatDay(key)}，${group ? `总奶量 ${group.total} ml` : "暂无记录"}`);

    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = day;

    const dayTotal = document.createElement("span");
    dayTotal.className = "day-total";
    dayTotal.textContent = group ? `${group.total} ml` : "";

    button.append(dayNumber, dayTotal);
    calendarGrid.append(button);
  }
}

function renderDetail(groups) {
  const group = groups[selectedDateKey];
  const selectedRecords = [...(group?.records || [])].sort((a, b) => new Date(b.time) - new Date(a.time));

  detailDateLabel.textContent = formatDay(selectedDateKey);
  selectedDayTotal.textContent = `${group?.total || 0} ml`;
  feedList.replaceChildren();

  if (selectedRecords.length === 0) {
    renderEmpty(feedList);
    return;
  }

  selectedRecords.forEach((record) => {
    const item = document.createElement("li");
    const isEditing = record.id === editingRecordId;
    item.className = `feed-item${isEditing ? " editing" : ""}`;
    if (isEditing) {
      item.innerHTML = `
        <div class="feed-time">
          <strong>${formatTime(record.time)}</strong>
          <span>${formatDay(dateKey(new Date(record.time)))}</span>
        </div>
        <div class="edit-amount-row">
          <input class="edit-amount-input" type="number" min="1" max="999" step="1" inputmode="numeric" value="${record.amount}" aria-label="修改奶量" data-edit-input="${record.id}" />
          <span>ml</span>
        </div>
        <div class="feed-edit-controls">
          <button class="mini-action save" type="button" data-save-id="${record.id}">保存</button>
          <button class="mini-action" type="button" data-cancel-edit>取消</button>
        </div>
      `;
    } else {
      item.innerHTML = `
        <div class="feed-time">
          <strong>${formatTime(record.time)}</strong>
          <span>${formatDay(dateKey(new Date(record.time)))}</span>
        </div>
        <span class="feed-amount">${record.amount} ml</span>
        <div class="feed-actions">
          <button class="mini-action" type="button" data-edit-id="${record.id}">修改</button>
          <button class="delete-button" type="button" aria-label="删除这条记录" data-delete-id="${record.id}">&times;</button>
        </div>
      `;
    }
    feedList.append(item);
  });

  const activeInput = feedList.querySelector(`[data-edit-input="${editingRecordId}"]`);
  activeInput?.focus();
  activeInput?.select();
}

function render() {
  records.sort((a, b) => new Date(b.time) - new Date(a.time));
  const groups = groupedByDay();
  const todayKey = dateKey(new Date());

  todayTotal.textContent = `${groups[todayKey]?.total || 0} ml`;
  renderCalendar(groups);
  renderDetail(groups);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(amountInput.value);
  const time = new Date(timeInput.value);

  if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(time.getTime())) {
    return;
  }

  records.unshift({
    id: createId(),
    amount: Math.round(amount),
    time: time.toISOString(),
  });

  const recordDayKey = dateKey(time);
  selectedDateKey = recordDayKey;
  visibleMonth = startOfMonth(time);
  saveRecords();
  amountInput.value = "";
  timeWasEdited = false;
  setCurrentTimeInput(true);
  render();
  showDetail(recordDayKey);
});

document.querySelectorAll("[data-amount]").forEach((button) => {
  button.addEventListener("click", () => {
    setCurrentTimeInput();
    amountInput.value = button.dataset.amount;
    amountInput.focus();
  });
});

timeInput.addEventListener("input", () => {
  timeWasEdited = true;
});

calendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  editingRecordId = "";
  showDetail(button.dataset.date);
});

feedList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    editingRecordId = editButton.dataset.editId;
    render();
    return;
  }

  const cancelButton = event.target.closest("[data-cancel-edit]");
  if (cancelButton) {
    editingRecordId = "";
    render();
    return;
  }

  const saveButton = event.target.closest("[data-save-id]");
  if (saveButton) {
    const input = feedList.querySelector(`[data-edit-input="${saveButton.dataset.saveId}"]`);
    const amount = Number(input?.value);
    if (!Number.isFinite(amount) || amount <= 0) return;
    records = records.map((record) => (
      record.id === saveButton.dataset.saveId
        ? { ...record, amount: Math.round(amount) }
        : record
    ));
    editingRecordId = "";
    saveRecords();
    render();
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    records = records.filter((record) => record.id !== deleteButton.dataset.deleteId);
    if (editingRecordId === deleteButton.dataset.deleteId) {
      editingRecordId = "";
    }
    saveRecords();
    render();
  }
});

feedList.addEventListener("keydown", (event) => {
  const input = event.target.closest("[data-edit-input]");
  if (!input) return;

  if (event.key === "Enter") {
    event.preventDefault();
    const saveButton = feedList.querySelector(`[data-save-id="${input.dataset.editInput}"]`);
    saveButton?.click();
  }

  if (event.key === "Escape") {
    editingRecordId = "";
    render();
  }
});

clearTodayButton.addEventListener("click", () => {
  const todayKey = dateKey(new Date());
  records = records.filter((record) => dateKey(new Date(record.time)) !== todayKey);
  saveRecords();
  render();
});

clearSelectedDayButton.addEventListener("click", () => {
  records = records.filter((record) => dateKey(new Date(record.time)) !== selectedDateKey);
  saveRecords();
  render();
});

backToCalendarButton.addEventListener("click", showCalendar);

prevMonthButton.addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  render();
});

nextMonthButton.addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  render();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    setCurrentTimeInput();
  }
});

setCurrentTimeInput(true);
setInterval(() => setCurrentTimeInput(), 30000);
render();
