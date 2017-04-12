       identification division.
       program-id. add--apikey.

       environment division.
       input-output section.
       file-control.
         select optional keyvalue assign to external 'db.dat'
           organization is indexed
           access mode is random
           record key is name
           lock mode is automatic
           sharing with all other.

       data division.
       file section.
         fd keyvalue is external.
         01 ssection.
           02 name picture x(40).
           02 api-keys occurs 9 times.
             03 api-key picture x(80).
           02 api-keys-count picture 9.

       working-storage section.
       01 need-more picture 9.
       01 ind picture 9.

       linkage section.
       01 argc binary-long unsigned.
       01 argv.
         02 section-name picture x(40).
         02 oldkey picture x(80).
         02 newkey picture x(80).
         02 filler picture x(813).
       01 result.
         02 state picture x(2).
         02 filler picture x(1022).
       01 result-length binary-long unsigned.

       procedure division 
         using argc, argv, result, result-length 
         returning need-more.
       start-api--key.
           if argc is less than 53
             move 1 to need-more
             goback
           else
             move zero to need-more
           end-if

           move section-name to name
           read keyvalue record
             invalid key
               move 'bn' to state
               move 2 to result-length
               goback
           end-read

           if api-keys-count is equal to 9
             move 'mk' to state
             move 2 to result-length
             goback
           end-if
        
           perform 
             varying ind 
               from 1 by 1 until ind is greater than api-keys-count
             if oldkey is equal to api-key(ind)
               add 1 to api-keys-count end-add
               move newkey to api-key(api-keys-count)
               rewrite ssection
                 invalid key
                   move 'fl' to state
                   move 2 to result-length
                   goback
               end-rewrite
               move 'ok' to state
               move 2 to result-length
               goback
             end-if
           end-perform

           move 'na' to state
           move 2 to result-length.

       update-section.
       end program add--apikey.