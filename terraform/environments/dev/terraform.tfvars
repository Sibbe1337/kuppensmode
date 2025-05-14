# terraform/environments/dev/terraform.tfvars
# Environment-specific values for 'dev'.

gcp_project_id     = "notion-lifeline"
gcp_region         = "europe-west1"
app_name_prefix    = "nl"
gcp_project_number = "343417106506"
common_tags = {
  owner       = "emil_soujeh"
  application = "notion-lifeline"
  # cost-center = "engineering-prototyping"
}

# You can override other variables defined in variables.tf (root or dev) here if needed.
# For example, if you want a specific prefix for dev resources different from the root default:
# app_name_prefix = "nl-dev"

# Example of overriding/setting specific tags for the dev environment:
# common_tags = {
#   application = "notion-lifeline" # from root
#   environment = "development"     # specific to dev
#   owner       = "dev-team"
# } 