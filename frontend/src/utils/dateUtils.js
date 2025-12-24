/**
 * Convert UTC timestamp to local time
 */
export const parseUTCDate = (timestamp) => {
  if (!timestamp) return null;
  
  // If timestamp doesn't end with 'Z', add it to indicate UTC
  const utcTimestamp = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
  return new Date(utcTimestamp);
};

/**
 * Format timestamp as "time ago" (e.g., "2 hours ago")
 */
export const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const time = parseUTCDate(timestamp);
  
  if (!time) return 'Unknown';
  
  const seconds = Math.floor((now - time) / 1000);

  if (seconds < 0) return 'Just now'; // Future dates
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
  
  // For older dates, show full date
  return time.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format timestamp as full date/time
 */
export const formatDateTime = (timestamp) => {
  const time = parseUTCDate(timestamp);
  if (!time) return 'Unknown';
  
  return time.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Format timestamp as date only
 */
export const formatDate = (timestamp) => {
  const time = parseUTCDate(timestamp);
  if (!time) return 'Unknown';
  
  return time.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};
