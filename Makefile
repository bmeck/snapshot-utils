all: doc
	@mkdir -p out
	@esdoc -c esdoc.json 
	@babel lib\
		--optional runtime\
		--out-dir out\
	 	--source-maps true
	@echo built

watch:
	watch-run -i -p "lib/**.js" -- make all

clean:
	rm -rf out/
