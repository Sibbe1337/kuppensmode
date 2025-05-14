output "job_name" {
  description = "The name of the Cloud Scheduler job."
  value       = google_cloud_scheduler_job.job.name
}

output "job_id" {
  description = "The full ID of the Cloud Scheduler job."
  value       = google_cloud_scheduler_job.job.id
} 