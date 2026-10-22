update public.listings
set category = 'notes'
where lower(category) in ('ders notları / pdf', 'pdf')
   or (
     lower(category) in ('kitap', 'books')
     and pdf_url is not null
     and (
       university_name is not null
       or department_name is not null
       or grade_level is not null
     )
   );

notify pgrst, 'reload schema';
