output "name" {
  description = "The full name of the Pub/Sub topic (projects/PROJECT_ID/topics/TOPIC_NAME)."
  value       = google_pubsub_topic.topic.id # .id returns the full resource name
}

output "topic_name_short" {
  description = "The short name of the Pub/Sub topic."
  value       = google_pubsub_topic.topic.name
} 