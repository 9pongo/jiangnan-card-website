INSERT INTO users (id,email,display_name,role)
VALUES ('00000000-0000-0000-0000-000000000006','public-submission@example.invalid','公開寄售送件','consignment_staff')
ON CONFLICT (id) DO NOTHING;
