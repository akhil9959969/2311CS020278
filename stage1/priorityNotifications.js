const axios = require('axios');

// IMPORTANT: Replace this with your actual token from the Pre-Test Setup
// Get it from: POST http://4.224.186.213/evaluation-service/auth
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiIyMzExY3MwMjAyNzhAbWFsbGFyZWRkeXVuaXZlcnNpdHkuYWMuaW4iLCJleHAiOjE3ODI4ODgyNDcsImlhdCI6MTc4Mjg4NzM0NywiaXNzIjoiQWZmb3JkIE1lZGljYWwgVGVjaG5vbG9naWVzIFByaXZhdGUgTGltaXRlZCIsImp0aSI6ImZiYjkyYTExLWJlODctNGE5ZC05MTI2LThjNWMwOTMwMDJmNyIsImxvY2FsZSI6ImVuLUlOIiwibmFtZSI6ImphdnZhamkgYWtoaWwga3VtYXIiLCJzdWIiOiI5Yzc5NGFiZC1kNTBiLTQzY2UtODRkNi0zMjZmYzFhMDcyMDMifSwiZW1haWwiOiIyMzExY3MwMjAyNzhAbWFsbGFyZWRkeXVuaXZlcnNpdHkuYWMuaW4iLCJuYW1lIjoiamF2dmFqaSBha2hpbCBrdW1hciIsInJvbGxObyI6IjIzMTFjczAyMDI3OCIsImFjY2Vzc0NvZGUiOiJ4cFFkZGQiLCJjbGllbnRJRCI6IjljNzk0YWJkLWQ1MGItNDNjZS04NGQ2LTMyNmZjMWEwNzIwMyIsImNsaWVudFNlY3JldCI6InZHRHRSWEpocmdjRVBkZHIifQ.IH4t8xemDF1RKkOc8jOpIQGT-oXLgSHwDSmYA3q3Css';

const log = (level, message, data) => {
  console.log(`[${level}] ${new Date().toISOString()} - ${message}`, data || '');
};

const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1
};

async function fetchNotifications() {
  log('INFO', 'Fetching notifications from API', { url: 'http://4.224.186.213/evaluation-service/notifications' });
  try {
    const response = await axios.get('http://4.224.186.213/evaluation-service/notifications', {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      }
    });
    const notifications = response.data.notifications || [];
    log('INFO', 'Successfully fetched notifications', { count: notifications.length });
    return notifications;
  } catch (error) {
    log('ERROR', 'Failed to fetch notifications', { message: error.message });
    return [];
  }
}

function computePriority(notification) {
  const weight = TYPE_WEIGHT[notification.Type] || 0;
  const timestamp = new Date(notification.Timestamp).getTime();
  return weight * 1e12 + timestamp;
}

class MinHeap {
  constructor(limit) {
    this.heap = [];
    this.limit = limit;
  }

  insert(item) {
    const priority = item.priority;
    if (this.heap.length < this.limit) {
      this.heap.push(item);
      this._heapifyUp(this.heap.length - 1);
    } else if (priority > this.heap[0].priority) {
      this.heap[0] = item;
      this._heapifyDown(0);
    }
  }

  _heapifyUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].priority <= this.heap[index].priority) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  _heapifyDown(index) {
    const n = this.heap.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      if (left < n && this.heap[left].priority < this.heap[smallest].priority) smallest = left;
      if (right < n && this.heap[right].priority < this.heap[smallest].priority) smallest = right;
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }

  getSorted() {
    return this.heap.slice().sort((a, b) => b.priority - a.priority);
  }
}

async function getTopNotifications() {
  log('INFO', 'Starting Stage 1 – Priority Inbox calculation');
  const notifications = await fetchNotifications();
  if (!notifications.length) {
    log('WARN', 'No notifications received from API');
    console.log('No notifications to process.');
    return;
  }

  const heap = new MinHeap(10);
  notifications.forEach(notif => {
    const priority = computePriority(notif);
    heap.insert({ ...notif, priority });
  });

  const top10 = heap.getSorted();
  log('INFO', 'Top 10 priority notifications computed', { count: top10.length });

  console.log('\n======= TOP 10 PRIORITY NOTIFICATIONS =======');
  top10.forEach((item, index) => {
    console.log(`${index + 1}. [${item.Type}] ${item.Message}`);
    console.log(`   ID: ${item.ID}`);
    console.log(`   Time: ${item.Timestamp}`);
    console.log(`   Priority Score: ${item.priority}`);
    console.log('------------------------------------------');
  });
}

getTopNotifications().catch(err => {
  log('CRITICAL', 'Unhandled error in main execution', { error: err.message });
});