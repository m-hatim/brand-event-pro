
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view event assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own event assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own event assets" ON storage.objects;
