.PHONY: doc compile coverage watch test

all: doc compile

doc:
	@esdoc -c esdoc.json 

compile:
	@mkdir -p out
	@babel lib\
		--optional runtime\
		--out-dir out\
	 	--source-maps true
	@echo built

watch:
	watch-run -i -p "lib/**.js" -- make compile

clean:
	rm -rf out/ doc/
