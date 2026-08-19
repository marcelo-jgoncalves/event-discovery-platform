resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = ["cognito-idp:AdminDeleteUser"]
      Resource = "*"
    }]
  })
}
